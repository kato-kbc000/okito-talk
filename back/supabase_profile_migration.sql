-- おきとーーーーーーく：プロフィール機能DB移行
-- Supabase SQL Editorで実行してください。既存データは削除しません。

alter table public.posts
  add column if not exists visibility text not null default 'public'
  check (visibility in ('public','followers','private'));

alter table public.profiles
  add column if not exists theme_color text not null default '#2589ff';

create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table if not exists public.post_likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table if not exists public.post_saves (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table if not exists public.profile_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  location_sharing boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.location_shares (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  shared_with_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, shared_with_id),
  check (owner_id <> shared_with_id)
);

alter table public.follows enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_saves enable row level security;
alter table public.profile_settings enable row level security;
alter table public.location_shares enable row level security;

-- follows
DROP POLICY IF EXISTS follows_select_authenticated ON public.follows;
CREATE POLICY follows_select_authenticated ON public.follows
FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS follows_insert_self ON public.follows;
CREATE POLICY follows_insert_self ON public.follows
FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
DROP POLICY IF EXISTS follows_delete_self ON public.follows;
CREATE POLICY follows_delete_self ON public.follows
FOR DELETE TO authenticated USING (auth.uid() = follower_id);

-- likes: いいね一覧は公開、操作は本人のみ
DROP POLICY IF EXISTS post_likes_select_authenticated ON public.post_likes;
CREATE POLICY post_likes_select_authenticated ON public.post_likes
FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS post_likes_insert_self ON public.post_likes;
CREATE POLICY post_likes_insert_self ON public.post_likes
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS post_likes_delete_self ON public.post_likes;
CREATE POLICY post_likes_delete_self ON public.post_likes
FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- saves: 本人のみ閲覧・操作
DROP POLICY IF EXISTS post_saves_select_self ON public.post_saves;
CREATE POLICY post_saves_select_self ON public.post_saves
FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS post_saves_insert_self ON public.post_saves;
CREATE POLICY post_saves_insert_self ON public.post_saves
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS post_saves_delete_self ON public.post_saves;
CREATE POLICY post_saves_delete_self ON public.post_saves
FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- settings
DROP POLICY IF EXISTS profile_settings_select_self ON public.profile_settings;
CREATE POLICY profile_settings_select_self ON public.profile_settings
FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS profile_settings_insert_self ON public.profile_settings;
CREATE POLICY profile_settings_insert_self ON public.profile_settings
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS profile_settings_update_self ON public.profile_settings;
CREATE POLICY profile_settings_update_self ON public.profile_settings
FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- location shares: 所有者本人だけ管理。共有される側は関係確認のため閲覧可能
DROP POLICY IF EXISTS location_shares_select_participant ON public.location_shares;
CREATE POLICY location_shares_select_participant ON public.location_shares
FOR SELECT TO authenticated USING (auth.uid() = owner_id OR auth.uid() = shared_with_id);
DROP POLICY IF EXISTS location_shares_insert_owner ON public.location_shares;
CREATE POLICY location_shares_insert_owner ON public.location_shares
FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
DROP POLICY IF EXISTS location_shares_delete_owner ON public.location_shares;
CREATE POLICY location_shares_delete_owner ON public.location_shares
FOR DELETE TO authenticated USING (auth.uid() = owner_id);

-- placesの更新・削除を本人へ許可
DROP POLICY IF EXISTS places_update_own ON public.places;
CREATE POLICY places_update_own ON public.places
FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS places_delete_own ON public.places;
CREATE POLICY places_delete_own ON public.places
FOR DELETE TO authenticated USING (auth.uid() = user_id);

create index if not exists follows_following_idx on public.follows(following_id);
create index if not exists post_likes_post_idx on public.post_likes(post_id);
create index if not exists places_user_idx on public.places(user_id);
