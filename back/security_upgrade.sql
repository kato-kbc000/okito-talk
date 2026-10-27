-- Okito-Talk security migration. Run in Supabase SQL Editor after reviewing a backup.
-- This migration intentionally replaces policies for sensitive tables.
begin;
create table if not exists public.blocks (
 blocker_id uuid not null references public.profiles(id) on delete cascade,
 blocked_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(blocker_id,blocked_id), check(blocker_id <> blocked_id)
);
create table if not exists public.reports (
 id uuid primary key default gen_random_uuid(),
 reporter_id uuid not null references public.profiles(id) on delete cascade,
 target_user_id uuid references public.profiles(id) on delete set null,
 target_post_id uuid references public.posts(id) on delete set null,
 reason text not null check(length(btrim(reason)) between 5 and 1000),
 status text not null default 'pending' check(status in ('pending','reviewing','resolved','rejected')),
 created_at timestamptz not null default now(),
 check (target_user_id is not null or target_post_id is not null)
);
create index if not exists reports_created_idx on public.reports(created_at desc);
create index if not exists blocks_blocked_idx on public.blocks(blocked_id);
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
-- Remove existing policies, including permissive ones that could override these rules.
do $$ declare r record; begin
 for r in select schemaname, tablename, policyname from pg_policies
 where schemaname='public' and tablename in
 ('posts','community_members','community_location_shares','messages','blocks','reports') loop
 execute format('drop policy if exists %I on %I.%I',r.policyname,r.schemaname,r.tablename);
 end loop;
end $$;
-- SECURITY DEFINER prevents recursive RLS membership checks. Fixed search_path.
create or replace function public.okito_is_approved_member(p_community uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.community_members
 where community_id=p_community and user_id=p_user and status='approved');
$$;
revoke all on function public.okito_is_approved_member(uuid,uuid) from public;
grant execute on function public.okito_is_approved_member(uuid,uuid) to authenticated;
create or replace function public.okito_is_owner(p_community uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.communities where id=p_community and owner_id=p_user);
$$;
revoke all on function public.okito_is_owner(uuid,uuid) from public;
grant execute on function public.okito_is_owner(uuid,uuid) to authenticated;
-- Public posts may be read anonymously. Followers/private require authentication.
create policy ok_posts_read on public.posts for select to anon,authenticated using (
 (visibility='public' and community_id is null)
 or (auth.uid() is not null and user_id=auth.uid())
 or (auth.uid() is not null and community_id is null and visibility='followers'
     and exists(select 1 from public.follows f where f.follower_id=auth.uid() and f.following_id=posts.user_id))
 or (auth.uid() is not null and community_id is not null and
     public.okito_is_approved_member(community_id,auth.uid()))
);
create policy ok_posts_insert on public.posts for insert to authenticated with check (
 user_id=auth.uid() and (community_id is null or public.okito_is_approved_member(community_id,auth.uid()))
);
create policy ok_posts_update on public.posts for update to authenticated using(user_id=auth.uid())
 with check(user_id=auth.uid() and (community_id is null or public.okito_is_approved_member(community_id,auth.uid())));
create policy ok_posts_delete on public.posts for delete to authenticated using(user_id=auth.uid());
-- Only approved members can view private community member lists.
create policy ok_members_read on public.community_members for select to authenticated using (
 public.okito_is_approved_member(community_id,auth.uid()) or
 public.okito_is_owner(community_id,auth.uid()) or
 (user_id=auth.uid()) or
 exists(select 1 from public.communities c where c.id=community_id and not c.is_private)
);
-- Users can request to join. Owner row must be inserted with owner role.
create policy ok_members_join on public.community_members for insert to authenticated with check (
 user_id=auth.uid() and (
 (public.okito_is_owner(community_id,auth.uid()) and role='owner' and status='approved')
 or (not public.okito_is_owner(community_id,auth.uid()) and role='member' and
 status = case when (select c.is_private from public.communities c where c.id=community_id)
 then 'pending' else 'approved' end)
 ));
create policy ok_members_leave on public.community_members for delete to authenticated
 using(user_id=auth.uid() and not public.okito_is_owner(community_id,auth.uid()));
-- Membership approvals require a separate privileged admin workflow; never allow self-approval.
create policy ok_locations_read on public.community_location_shares for select to authenticated using (
 expires_at>now() and public.okito_is_approved_member(community_id,auth.uid())
 and public.okito_is_approved_member(community_id,user_id)
);
create policy ok_locations_insert on public.community_location_shares for insert to authenticated with check (
 user_id=auth.uid() and public.okito_is_approved_member(community_id,auth.uid())
 and expires_at>now() and expires_at<=now()+interval '24 hours'
);
create policy ok_locations_update on public.community_location_shares for update to authenticated
 using(user_id=auth.uid() and public.okito_is_approved_member(community_id,auth.uid()))
 with check(user_id=auth.uid() and public.okito_is_approved_member(community_id,auth.uid())
 and expires_at>now() and expires_at<=now()+interval '24 hours');
create policy ok_locations_delete on public.community_location_shares for delete to authenticated using(user_id=auth.uid());
create policy ok_messages_read on public.messages for select to authenticated using (
 (sender_id=auth.uid() or receiver_id=auth.uid())
);
create policy ok_messages_send on public.messages for insert to authenticated with check (
 sender_id=auth.uid() and sender_id<>receiver_id and is_read=false and read_at is null
 and not exists(select 1 from public.blocks b where
 (b.blocker_id=receiver_id and b.blocked_id=sender_id) or
 (b.blocker_id=sender_id and b.blocked_id=receiver_id))
);
-- Do not permit clients to modify message content or sender via UPDATE.
-- Read receipts should be implemented through a constrained RPC later.
create policy ok_blocks_read on public.blocks for select to authenticated using(blocker_id=auth.uid());
create policy ok_blocks_insert on public.blocks for insert to authenticated with check(blocker_id=auth.uid());
create policy ok_blocks_delete on public.blocks for delete to authenticated using(blocker_id=auth.uid());
create policy ok_reports_insert on public.reports for insert to authenticated
 with check(reporter_id=auth.uid() and status='pending');
create policy ok_reports_read on public.reports for select to authenticated using(reporter_id=auth.uid());
-- Prevent untrusted users from setting owner/admin on existing membership via table grants.
revoke update on public.community_members from anon, authenticated;
revoke update on public.reports from anon, authenticated;
revoke update on public.messages from anon, authenticated;
commit;

-- Read receipts without allowing arbitrary message UPDATE.
create or replace function public.okito_mark_conversation_read(p_sender uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare changed integer;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 update public.messages set is_read=true, read_at=now()
 where receiver_id=auth.uid() and sender_id=p_sender and not is_read;
 get diagnostics changed = row_count;
 return changed;
end $$;
revoke all on function public.okito_mark_conversation_read(uuid) from public;
grant execute on function public.okito_mark_conversation_read(uuid) to authenticated;
