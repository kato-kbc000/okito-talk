-- Apply AFTER security_upgrade.sql; test on a staging project first.
-- Never run with the service-role key in a browser.
begin;
-- Only a community owner can approve or reject a request.
create or replace function public.okito_review_join_request(p_community uuid, p_user uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null or not public.okito_is_owner(p_community, auth.uid()) then
   raise exception 'Permission denied' using errcode='42501';
 end if;
 update public.community_members
 set status=case when p_approve then 'approved' else 'rejected' end
 where community_id=p_community and user_id=p_user and role='member' and status='pending';
 if not found then raise exception 'Pending request not found'; end if;
end $$;
revoke all on function public.okito_review_join_request(uuid,uuid,boolean) from public;
grant execute on function public.okito_review_join_request(uuid,uuid,boolean) to authenticated;
-- Read requests only if owner, enforced by membership RLS in security_upgrade.sql.
-- Prevent broad access to reports: only the reporter can see their own reports.
create index if not exists community_members_pending_idx
 on public.community_members(community_id,status) where status='pending';
-- Restrict report status to the server-side moderation process.
commit;
