-- おきとーーーーーーく Supabase セットアップ
-- Supabase SQL Editorで一度実行してください。
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[A-Za-z0-9_]+$'),
  display_name text not null,
  bio text,
  avatar_url text,
  header_url text,
  city text,
  is_private boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 200), image_url text,
  location_name text, location_address text, latitude double precision, longitude double precision,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.places (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null, address text not null, description text, latitude double precision, longitude double precision,
  created_at timestamptz not null default now()
);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(), sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade, content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now(), read_at timestamptz
);
create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null, description text, created_at timestamptz not null default now()
);
create table if not exists public.community_members (
  community_id uuid references public.communities(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(), primary key (community_id,user_id)
);

alter table public.profiles enable row level security; alter table public.posts enable row level security;
alter table public.places enable row level security; alter table public.messages enable row level security;
alter table public.communities enable row level security; alter table public.community_members enable row level security;

drop policy if exists profiles_select on public.profiles; create policy profiles_select on public.profiles for select to authenticated using (true);
drop policy if exists profiles_insert_own on public.profiles; create policy profiles_insert_own on public.profiles for insert to authenticated with check (auth.uid()=id);
drop policy if exists profiles_update_own on public.profiles; create policy profiles_update_own on public.profiles for update to authenticated using (auth.uid()=id) with check (auth.uid()=id);
drop policy if exists posts_select on public.posts; create policy posts_select on public.posts for select to authenticated using (true);
drop policy if exists posts_insert_own on public.posts; create policy posts_insert_own on public.posts for insert to authenticated with check (auth.uid()=user_id);
drop policy if exists posts_update_own on public.posts; create policy posts_update_own on public.posts for update to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
drop policy if exists posts_delete_own on public.posts; create policy posts_delete_own on public.posts for delete to authenticated using (auth.uid()=user_id);
drop policy if exists places_select on public.places; create policy places_select on public.places for select to authenticated using (true);
drop policy if exists places_insert_own on public.places; create policy places_insert_own on public.places for insert to authenticated with check (auth.uid()=user_id);
drop policy if exists messages_select_participant on public.messages; create policy messages_select_participant on public.messages for select to authenticated using (auth.uid()=sender_id or auth.uid()=receiver_id);
drop policy if exists messages_insert_sender on public.messages; create policy messages_insert_sender on public.messages for insert to authenticated with check (auth.uid()=sender_id);
drop policy if exists communities_select on public.communities; create policy communities_select on public.communities for select to authenticated using (true);
drop policy if exists communities_insert_owner on public.communities; create policy communities_insert_owner on public.communities for insert to authenticated with check (auth.uid()=owner_id);
drop policy if exists members_select on public.community_members; create policy members_select on public.community_members for select to authenticated using (true);
drop policy if exists members_join_self on public.community_members; create policy members_join_self on public.community_members for insert to authenticated with check (auth.uid()=user_id);
