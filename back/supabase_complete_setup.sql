-- おきとーーーーーーく / Supabase 統合修正SQL
-- 既存データを削除しません。Supabase SQL Editorで全体を1回実行してください。

begin;

create extension if not exists pgcrypto;

-- 投稿画像用の公開Storageバケット（1ファイル5MBまで）
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-images', 'post-images', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 添付スキーマに不足している機能テーブル
create table if not exists public.profile_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  location_sharing boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.community_location_shares (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  label varchar(60) not null,
  latitude numeric(9,6) not null check (latitude between -90 and 90),
  longitude numeric(9,6) not null check (longitude between -180 and 180),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (community_id, user_id)
);

insert into public.categories (name) values
  ('地域'), ('自然・海'), ('グルメ'), ('文化・伝統'), ('スポーツ'),
  ('旅行・観光'), ('音楽'), ('趣味'), ('子育て'), ('学校・学習'),
  ('仕事'), ('イベント'), ('その他')
on conflict (name) do nothing;

-- 古いDBにも不足列だけを追加
alter table public.spots add column if not exists address text;
alter table public.posts add column if not exists visibility varchar not null default 'public';
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

-- 既存の誤座標は壊さず、今後の沖縄県外座標だけを拒否
do $$
begin
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

create index if not exists posts_created_at_idx on public.posts(created_at desc);
create index if not exists posts_user_id_idx on public.posts(user_id, created_at desc);
create index if not exists likes_post_id_idx on public.likes(post_id);
create index if not exists bookmarks_post_id_idx on public.bookmarks(post_id);
create index if not exists follows_following_id_idx on public.follows(following_id);
create index if not exists spots_user_id_idx on public.spots(user_id, created_at desc);
create index if not exists community_locations_expires_idx on public.community_location_shares(expires_at);

-- 新着メッセージ通知用Realtime（すでに登録済みなら何もしない）
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- RLSを有効化
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.categories enable row level security;
alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.community_keywords enable row level security;
alter table public.follows enable row level security;
alter table public.likes enable row level security;
alter table public.bookmarks enable row level security;
alter table public.location_shares enable row level security;
alter table public.spots enable row level security;
alter table public.messages enable row level security;
alter table public.profile_settings enable row level security;
alter table public.community_location_shares enable row level security;

-- 旧ポリシーにRESTRICTIVE設定や不整合があっても403が残らないよう、
-- 問題が発生している3テーブルだけ既存ポリシーを整理します。
do $$
declare p record;
begin
  for p in select policyname, tablename from pg_policies
           where schemaname = 'public' and tablename in ('likes','bookmarks','spots')
  loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- profiles
drop policy if exists profiles_select_authenticated on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_select_authenticated on public.profiles for select to authenticated using (true);
create policy profiles_insert_own on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy profiles_update_own on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- posts
drop policy if exists posts_select_authenticated on public.posts;
drop policy if exists posts_insert_own on public.posts;
drop policy if exists posts_update_own on public.posts;
drop policy if exists posts_delete_own on public.posts;
create policy posts_select_authenticated on public.posts for select to authenticated using (true);
create policy posts_insert_own on public.posts for insert to authenticated with check (auth.uid() = user_id);
create policy posts_update_own on public.posts for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy posts_delete_own on public.posts for delete to authenticated using (auth.uid() = user_id);

-- likes: 集計と「いいねした投稿」表示のため閲覧可、変更は本人のみ
drop policy if exists likes_select_authenticated on public.likes;
drop policy if exists likes_insert_own on public.likes;
drop policy if exists likes_delete_own on public.likes;
create policy likes_select_authenticated on public.likes for select to authenticated using (true);
create policy likes_insert_own on public.likes for insert to authenticated with check (auth.uid() = user_id);
create policy likes_delete_own on public.likes for delete to authenticated using (auth.uid() = user_id);

-- bookmarks: 本人だけ閲覧・変更
drop policy if exists bookmarks_select_own on public.bookmarks;
drop policy if exists bookmarks_insert_own on public.bookmarks;
drop policy if exists bookmarks_delete_own on public.bookmarks;
create policy bookmarks_select_own on public.bookmarks for select to authenticated using (auth.uid() = user_id);
create policy bookmarks_insert_own on public.bookmarks for insert to authenticated with check (auth.uid() = user_id);
create policy bookmarks_delete_own on public.bookmarks for delete to authenticated using (auth.uid() = user_id);

-- spots: 全員が閲覧、作成・更新・削除は所有者のみ
drop policy if exists spots_select_authenticated on public.spots;
drop policy if exists spots_insert_own on public.spots;
drop policy if exists spots_update_own on public.spots;
drop policy if exists spots_delete_own on public.spots;
create policy spots_select_authenticated on public.spots for select to authenticated using (true);
create policy spots_insert_own on public.spots for insert to authenticated with check (auth.uid() = user_id);
create policy spots_update_own on public.spots for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy spots_delete_own on public.spots for delete to authenticated using (auth.uid() = user_id);

-- follows
drop policy if exists follows_select_authenticated on public.follows;
drop policy if exists follows_insert_own on public.follows;
drop policy if exists follows_delete_own on public.follows;
create policy follows_select_authenticated on public.follows for select to authenticated using (true);
create policy follows_insert_own on public.follows for insert to authenticated with check (auth.uid() = follower_id and follower_id <> following_id);
create policy follows_delete_own on public.follows for delete to authenticated using (auth.uid() = follower_id);

-- categories / communities / members / keywords
drop policy if exists categories_select_authenticated on public.categories;
create policy categories_select_authenticated on public.categories for select to authenticated using (true);

drop policy if exists communities_select_authenticated on public.communities;
drop policy if exists communities_insert_owner on public.communities;
drop policy if exists communities_update_owner on public.communities;
drop policy if exists communities_delete_owner on public.communities;
create policy communities_select_authenticated on public.communities for select to authenticated using (true);
create policy communities_insert_owner on public.communities for insert to authenticated with check (auth.uid() = owner_id);
create policy communities_update_owner on public.communities for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy communities_delete_owner on public.communities for delete to authenticated using (auth.uid() = owner_id);

drop policy if exists community_members_select_authenticated on public.community_members;
drop policy if exists community_members_join_self on public.community_members;
drop policy if exists community_members_leave_self on public.community_members;
create policy community_members_select_authenticated on public.community_members for select to authenticated using (true);
create policy community_members_join_self on public.community_members for insert to authenticated with check (auth.uid() = user_id);
create policy community_members_leave_self on public.community_members for delete to authenticated using (auth.uid() = user_id);

drop policy if exists community_keywords_select_authenticated on public.community_keywords;
drop policy if exists community_keywords_owner_all on public.community_keywords;
create policy community_keywords_select_authenticated on public.community_keywords for select to authenticated using (true);
create policy community_keywords_owner_all on public.community_keywords for all to authenticated
using (exists (select 1 from public.communities c where c.id = community_id and c.owner_id = auth.uid()))
with check (exists (select 1 from public.communities c where c.id = community_id and c.owner_id = auth.uid()));

-- messages
drop policy if exists messages_select_participant on public.messages;
drop policy if exists messages_insert_sender on public.messages;
drop policy if exists messages_update_receiver on public.messages;
create policy messages_select_participant on public.messages for select to authenticated using (auth.uid() = sender_id or auth.uid() = receiver_id);
create policy messages_insert_sender on public.messages for insert to authenticated with check (auth.uid() = sender_id);
create policy messages_update_receiver on public.messages for update to authenticated using (auth.uid() = receiver_id) with check (auth.uid() = receiver_id);

-- profile settings
drop policy if exists profile_settings_select_own on public.profile_settings;
drop policy if exists profile_settings_insert_own on public.profile_settings;
drop policy if exists profile_settings_update_own on public.profile_settings;
create policy profile_settings_select_own on public.profile_settings for select to authenticated using (auth.uid() = user_id);
create policy profile_settings_insert_own on public.profile_settings for insert to authenticated with check (auth.uid() = user_id);
create policy profile_settings_update_own on public.profile_settings for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- location_shares: 実DBの列名 user_id / shared_with_user_id に統一
drop policy if exists location_shares_select_participant on public.location_shares;
drop policy if exists location_shares_insert_owner on public.location_shares;
drop policy if exists location_shares_update_owner on public.location_shares;
drop policy if exists location_shares_delete_owner on public.location_shares;
create policy location_shares_select_participant on public.location_shares for select to authenticated using (auth.uid() = user_id or auth.uid() = shared_with_user_id);
create policy location_shares_insert_owner on public.location_shares for insert to authenticated with check (auth.uid() = user_id and user_id <> shared_with_user_id);
create policy location_shares_update_owner on public.location_shares for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy location_shares_delete_owner on public.location_shares for delete to authenticated using (auth.uid() = user_id);

-- コミュニティ内の24時間位置共有
drop policy if exists community_locations_select_members on public.community_location_shares;
drop policy if exists community_locations_insert_self on public.community_location_shares;
drop policy if exists community_locations_update_self on public.community_location_shares;
drop policy if exists community_locations_delete_self on public.community_location_shares;
create policy community_locations_select_members on public.community_location_shares for select to authenticated
using (expires_at > now() and exists (select 1 from public.community_members cm where cm.community_id = community_location_shares.community_id and cm.user_id = auth.uid()));
create policy community_locations_insert_self on public.community_location_shares for insert to authenticated
with check (auth.uid() = user_id and exists (select 1 from public.community_members cm where cm.community_id = community_location_shares.community_id and cm.user_id = auth.uid()));
create policy community_locations_update_self on public.community_location_shares for update to authenticated
using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy community_locations_delete_self on public.community_location_shares for delete to authenticated using (auth.uid() = user_id);

-- Storage: 公開画像は誰でも表示、アップロード・変更・削除は本人のフォルダだけ
drop policy if exists post_images_public_read on storage.objects;
drop policy if exists post_images_insert_own on storage.objects;
drop policy if exists post_images_update_own on storage.objects;
drop policy if exists post_images_delete_own on storage.objects;
create policy post_images_public_read on storage.objects for select using (bucket_id = 'post-images');
create policy post_images_insert_own on storage.objects for insert to authenticated
with check (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy post_images_update_own on storage.objects for update to authenticated
using (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy post_images_delete_own on storage.objects for delete to authenticated
using (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

commit;
