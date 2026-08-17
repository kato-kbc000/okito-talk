-- community_member.html 用追加テーブル・RLS

create table if not exists public.follows (
    follower_id uuid not null references public.profiles(id) on delete cascade,
    following_id uuid not null references public.profiles(id) on delete cascade,
    created_at timestamptz not null default now(),
    constraint follows_pkey primary key (follower_id, following_id),
    constraint follows_not_self check (follower_id <> following_id)
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
    constraint community_location_shares_pkey primary key (community_id, user_id)
);

create index if not exists follows_following_id_idx on public.follows(following_id);
create index if not exists community_location_shares_expires_at_idx on public.community_location_shares(expires_at);

alter table public.follows enable row level security;
alter table public.community_location_shares enable row level security;

drop policy if exists "follows_select_authenticated" on public.follows;
drop policy if exists "follows_insert_self" on public.follows;
drop policy if exists "follows_delete_self" on public.follows;

create policy "follows_select_authenticated"
on public.follows for select to authenticated
using (true);

create policy "follows_insert_self"
on public.follows for insert to authenticated
with check (auth.uid() = follower_id);

create policy "follows_delete_self"
on public.follows for delete to authenticated
using (auth.uid() = follower_id);

drop policy if exists "community_locations_select_members" on public.community_location_shares;
drop policy if exists "community_locations_insert_self" on public.community_location_shares;
drop policy if exists "community_locations_update_self" on public.community_location_shares;
drop policy if exists "community_locations_delete_self" on public.community_location_shares;

create policy "community_locations_select_members"
on public.community_location_shares for select to authenticated
using (
    expires_at > now()
    and exists (
        select 1
        from public.community_members cm
        where cm.community_id = community_location_shares.community_id
          and cm.user_id = auth.uid()
    )
);

create policy "community_locations_insert_self"
on public.community_location_shares for insert to authenticated
with check (
    auth.uid() = user_id
    and exists (
        select 1 from public.community_members cm
        where cm.community_id = community_location_shares.community_id
          and cm.user_id = auth.uid()
    )
);

create policy "community_locations_update_self"
on public.community_location_shares for update to authenticated
using (auth.uid() = user_id)
with check (
    auth.uid() = user_id
    and exists (
        select 1 from public.community_members cm
        where cm.community_id = community_location_shares.community_id
          and cm.user_id = auth.uid()
    )
);

create policy "community_locations_delete_self"
on public.community_location_shares for delete to authenticated
using (auth.uid() = user_id);

grant select, insert, delete on public.follows to authenticated;
grant select, insert, update, delete on public.community_location_shares to authenticated;
