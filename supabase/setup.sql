-- =====================================================================
-- おきとーーーーーーく  Supabase セットアップ SQL（統合版・何度実行しても安全）
--
-- 使い方: Supabase の SQL Editor に全体を貼り付けて 1 回実行してください。
-- 既存データは削除しません。既存テーブルに足りない列・ポリシーだけを補います。
-- 前提: profiles / posts / communities などの基本テーブルは作成済みであること。
-- =====================================================================

begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. 不足している列・テーブル
-- ---------------------------------------------------------------------
alter table public.spots    add column if not exists address text;
alter table public.posts    add column if not exists visibility varchar not null default 'public';
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
alter table public.profiles add column if not exists theme_color varchar not null default '#3B82F6';

-- コミュニティ: ルール・絵文字アイコン・公開範囲
alter table public.communities add column if not exists rules text[] not null default '{}';
alter table public.communities add column if not exists icon_emoji varchar not null default '🌺';
alter table public.communities add column if not exists visibility varchar not null default 'public';

-- 既存の is_private から visibility を引き継ぐ（初回のみ影響）
update public.communities
   set visibility = 'private'
 where is_private = true and visibility = 'public';

-- 投稿: 複数画像（先頭が image_url と同じ）
alter table public.posts add column if not exists image_urls text[] not null default '{}';

-- コメント: 画像添付
alter table public.comments add column if not exists image_url text;

-- CHECK 制約（まだ無い場合のみ追加）
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'communities_visibility_check') then
    alter table public.communities
      add constraint communities_visibility_check
      check (visibility in ('public', 'approval', 'private'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'community_members_role_check') then
    alter table public.community_members
      add constraint community_members_role_check
      check (role in ('owner', 'admin', 'member'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'follows_not_self') then
    alter table public.follows
      add constraint follows_not_self check (follower_id <> following_id);
  end if;
  -- 沖縄県外の座標は今後登録させない（既存データは検証しない）
  if not exists (select 1 from pg_constraint where conname = 'spots_okinawa_coordinates') then
    alter table public.spots add constraint spots_okinawa_coordinates check (
      (latitude is null and longitude is null) or
      (latitude between 24 and 28.8 and longitude between 122.5 and 131.5)
    ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'posts_okinawa_coordinates') then
    alter table public.posts add constraint posts_okinawa_coordinates check (
      (latitude is null and longitude is null) or
      (latitude between 24 and 28.8 and longitude between 122.5 and 131.5)
    ) not valid;
  end if;
end $$;

-- カテゴリの初期データ
insert into public.categories (name) values
  ('地域'), ('自然・海'), ('グルメ'), ('文化・伝統'), ('スポーツ'),
  ('旅行・観光'), ('音楽'), ('趣味'), ('子育て'), ('学校・学習'),
  ('仕事'), ('イベント'), ('その他')
on conflict (name) do nothing;

-- インデックス
update public.posts set image_urls = array[image_url]
 where image_url is not null and coalesce(array_length(image_urls, 1), 0) = 0;

create index if not exists posts_created_at_idx          on public.posts(created_at desc);
create index if not exists posts_user_id_idx             on public.posts(user_id, created_at desc);
create index if not exists posts_community_id_idx        on public.posts(community_id, created_at desc);
create index if not exists comments_post_id_idx          on public.comments(post_id, created_at);
create index if not exists likes_post_id_idx             on public.likes(post_id);
create index if not exists bookmarks_post_id_idx         on public.bookmarks(post_id);
create index if not exists follows_following_id_idx      on public.follows(following_id);
create index if not exists spots_user_id_idx             on public.spots(user_id, created_at desc);
create index if not exists community_members_user_idx    on public.community_members(user_id);
create index if not exists community_locations_expires_idx on public.community_location_shares(expires_at);
create index if not exists messages_receiver_idx         on public.messages(receiver_id, is_read);

-- ---------------------------------------------------------------------
-- 2. RLS 用ヘルパー関数（security definer で RLS の循環参照を避ける）
-- ---------------------------------------------------------------------
create or replace function public.is_community_member(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.community_members
     where community_id = cid and user_id = auth.uid() and status = 'approved'
  );
$$;

create or replace function public.community_visibility(cid uuid)
returns text language sql stable security definer set search_path = public as $$
  select visibility::text from public.communities where id = cid;
$$;

create or replace function public.community_owner_id(cid uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select owner_id from public.communities where id = cid;
$$;

create or replace function public.is_community_manager(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.communities c
     where c.id = cid and c.owner_id = auth.uid()
  ) or exists (
    select 1 from public.community_members m
     where m.community_id = cid and m.user_id = auth.uid()
       and m.status = 'approved' and m.role in ('owner', 'admin')
  );
$$;

-- コミュニティの中身（投稿・コメント）を読めるか
--   公開コミュニティ: 誰でも / 承認制・非公開: 承認済みメンバーのみ
create or replace function public.can_read_community(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.community_visibility(cid) = 'public' or public.is_community_member(cid);
$$;

create or replace function public.is_following(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.follows
     where follower_id = auth.uid() and following_id = target
  );
$$;

-- 通常投稿 / コミュニティ投稿 を 1 つの条件で判定する
create or replace function public.can_read_post(p public.posts)
returns boolean language sql stable security definer set search_path = public as $$
  select
    p.user_id = auth.uid()
    or case
         when p.community_id is not null then public.can_read_community(p.community_id)
         when p.visibility = 'public'     then true
         when p.visibility = 'followers'  then public.is_following(p.user_id)
         else false
       end;
$$;

-- ---------------------------------------------------------------------
-- 3. RLS 有効化
-- ---------------------------------------------------------------------
alter table public.profiles                  enable row level security;
alter table public.posts                     enable row level security;
alter table public.categories                enable row level security;
alter table public.communities               enable row level security;
alter table public.community_members         enable row level security;
alter table public.community_keywords        enable row level security;
alter table public.follows                   enable row level security;
alter table public.likes                     enable row level security;
alter table public.bookmarks                 enable row level security;
alter table public.comments                  enable row level security;
alter table public.notifications             enable row level security;
alter table public.location_shares           enable row level security;
alter table public.spots                     enable row level security;
alter table public.messages                  enable row level security;
alter table public.profile_settings          enable row level security;
alter table public.community_location_shares enable row level security;

-- 古いポリシーが残っていて 403 になるのを防ぐため、対象テーブルのポリシーを作り直す
do $$
declare p record;
begin
  for p in
    select policyname, tablename from pg_policies
     where schemaname = 'public'
       and tablename in (
         'profiles','posts','categories','communities','community_members',
         'community_keywords','follows','likes','bookmarks','comments',
         'notifications','location_shares','spots','messages','profile_settings',
         'community_location_shares'
       )
  loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- profiles
create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_insert_own on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy profiles_update_own on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- posts: 公開範囲を DB 側でも強制する
create policy posts_select on public.posts for select to authenticated using (public.can_read_post(posts));
create policy posts_insert_own on public.posts for insert to authenticated
  with check (
    auth.uid() = user_id
    and (community_id is null or public.is_community_member(community_id))
  );
create policy posts_update_own on public.posts for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy posts_delete_own on public.posts for delete to authenticated
  using (auth.uid() = user_id or (community_id is not null and public.is_community_manager(community_id)));

-- comments: 読める投稿にだけコメント可
create policy comments_select on public.comments for select to authenticated
  using (exists (select 1 from public.posts p where p.id = comments.post_id and public.can_read_post(p)));
create policy comments_insert_own on public.comments for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.posts p where p.id = comments.post_id and public.can_read_post(p))
  );
create policy comments_delete_own on public.comments for delete to authenticated
  using (auth.uid() = user_id);

-- likes: 件数表示のため閲覧可、変更は本人のみ
create policy likes_select on public.likes for select to authenticated using (true);
create policy likes_insert_own on public.likes for insert to authenticated with check (auth.uid() = user_id);
create policy likes_delete_own on public.likes for delete to authenticated using (auth.uid() = user_id);

-- bookmarks: 本人のみ
create policy bookmarks_select_own on public.bookmarks for select to authenticated using (auth.uid() = user_id);
create policy bookmarks_insert_own on public.bookmarks for insert to authenticated with check (auth.uid() = user_id);
create policy bookmarks_delete_own on public.bookmarks for delete to authenticated using (auth.uid() = user_id);

-- follows
create policy follows_select on public.follows for select to authenticated using (true);
create policy follows_insert_own on public.follows for insert to authenticated
  with check (auth.uid() = follower_id and follower_id <> following_id);
create policy follows_delete_own on public.follows for delete to authenticated using (auth.uid() = follower_id);

-- spots（ピン）: 全員閲覧、変更は本人のみ
create policy spots_select on public.spots for select to authenticated using (true);
create policy spots_insert_own on public.spots for insert to authenticated with check (auth.uid() = user_id);
create policy spots_update_own on public.spots for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy spots_delete_own on public.spots for delete to authenticated using (auth.uid() = user_id);

-- categories
create policy categories_select on public.categories for select to authenticated using (true);

-- communities: 非公開は本人・メンバー・参加申請者だけが見える
create policy communities_select on public.communities for select to authenticated
  using (
    visibility <> 'private'
    or owner_id = auth.uid()
    or public.is_community_manager(id)
    or exists (select 1 from public.community_members m
                where m.community_id = communities.id and m.user_id = auth.uid())
  );
create policy communities_insert_owner on public.communities for insert to authenticated
  with check (auth.uid() = owner_id);
create policy communities_update_manager on public.communities for update to authenticated
  using (public.is_community_manager(id)) with check (public.is_community_manager(id));
create policy communities_delete_owner on public.communities for delete to authenticated
  using (auth.uid() = owner_id);

-- community_members
--   参加: 公開 → 即参加(approved) / 承認制・非公開 → pending で申請 / オーナー自身 → owner
create policy community_members_select on public.community_members for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_community_manager(community_id)
    or (status = 'approved' and (
          public.community_visibility(community_id) <> 'private'
          or public.is_community_member(community_id)))
  );
create policy community_members_join on public.community_members for insert to authenticated
  with check (
    auth.uid() = user_id
    and (
      (role = 'owner' and status = 'approved'
         and public.community_owner_id(community_id) = auth.uid())
      or (role = 'member' and status = 'approved'
         and public.community_visibility(community_id) = 'public')
      or (role = 'member' and status = 'pending'
         and public.community_visibility(community_id) in ('approval', 'private'))
    )
  );
-- 承認・拒否・役割変更は管理者のみ（本人は変更不可）
create policy community_members_update_manager on public.community_members for update to authenticated
  using (public.is_community_manager(community_id))
  with check (public.is_community_manager(community_id));
-- 退会（本人）・メンバー削除（管理者）。オーナーは退会不可。
create policy community_members_delete on public.community_members for delete to authenticated
  using (
    role <> 'owner'
    and (
      (user_id = auth.uid() and status <> 'rejected')
      or public.is_community_manager(community_id)
    )
  );

-- community_keywords
create policy community_keywords_select on public.community_keywords for select to authenticated using (true);
create policy community_keywords_manage on public.community_keywords for all to authenticated
  using (public.is_community_manager(community_id))
  with check (public.is_community_manager(community_id));

-- messages
create policy messages_select on public.messages for select to authenticated
  using (auth.uid() = sender_id or auth.uid() = receiver_id);
create policy messages_insert_sender on public.messages for insert to authenticated
  with check (auth.uid() = sender_id and sender_id <> receiver_id);
create policy messages_update_receiver on public.messages for update to authenticated
  using (auth.uid() = receiver_id) with check (auth.uid() = receiver_id);

-- notifications（受信者本人のみ参照・更新。作成は本人が actor のときのみ）
create policy notifications_select_own on public.notifications for select to authenticated
  using (auth.uid() = user_id);
create policy notifications_insert_actor on public.notifications for insert to authenticated
  with check (auth.uid() = actor_id);
create policy notifications_update_own on public.notifications for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy notifications_delete_own on public.notifications for delete to authenticated
  using (auth.uid() = user_id);

-- profile_settings
create policy profile_settings_select_own on public.profile_settings for select to authenticated using (auth.uid() = user_id);
create policy profile_settings_insert_own on public.profile_settings for insert to authenticated with check (auth.uid() = user_id);
create policy profile_settings_update_own on public.profile_settings for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- location_shares（誰に現在地を見せるか）
create policy location_shares_select on public.location_shares for select to authenticated
  using (auth.uid() = user_id or auth.uid() = shared_with_user_id);
create policy location_shares_insert_owner on public.location_shares for insert to authenticated
  with check (auth.uid() = user_id and user_id <> shared_with_user_id);
create policy location_shares_update_owner on public.location_shares for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy location_shares_delete_owner on public.location_shares for delete to authenticated
  using (auth.uid() = user_id);

-- community_location_shares（コミュニティ内 24 時間位置共有）
-- 他のメンバーには「期限内」のものだけ見せる。自分の行は期限切れでも見える
-- （見えないと、期限切れの行が残っているとき upsert が RLS で失敗するため）
create policy community_locations_select on public.community_location_shares for select to authenticated
  using (
    auth.uid() = user_id
    or (expires_at > now() and public.is_community_member(community_id))
  );
create policy community_locations_insert_self on public.community_location_shares for insert to authenticated
  with check (auth.uid() = user_id and public.is_community_member(community_id));
create policy community_locations_update_self on public.community_location_shares for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and public.is_community_member(community_id));
create policy community_locations_delete_self on public.community_location_shares for delete to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 4. Storage（画像）
--    post-images      : 投稿・コメント画像（1 ファイル 5MB まで）
--    community-images : コミュニティのアイコン / カバー画像（2MB まで）
--    profile-images   : プロフィールのアイコン / ヘッダー画像（2MB まで）
--    アップロード先は「自分の user_id フォルダ」配下のみ許可
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('post-images', 'post-images', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif']),
  ('community-images', 'community-images', true, 2097152, array['image/jpeg','image/png','image/webp']),
  ('profile-images', 'profile-images', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
declare b text;
begin
  foreach b in array array['post-images', 'community-images', 'profile-images'] loop
    execute format('drop policy if exists %I on storage.objects', b || '_public_read');
    execute format('drop policy if exists %I on storage.objects', b || '_insert_own');
    execute format('drop policy if exists %I on storage.objects', b || '_update_own');
    execute format('drop policy if exists %I on storage.objects', b || '_delete_own');
    execute format('create policy %I on storage.objects for select using (bucket_id = %L)', b || '_public_read', b);
    execute format($f$create policy %I on storage.objects for insert to authenticated
      with check (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)$f$, b || '_insert_own', b);
    execute format($f$create policy %I on storage.objects for update to authenticated
      using (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)
      with check (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)$f$, b || '_update_own', b, b);
    execute format($f$create policy %I on storage.objects for delete to authenticated
      using (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)$f$, b || '_delete_own', b);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 5. Realtime（新着メッセージ通知）
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 6. 権限
-- ---------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

commit;
