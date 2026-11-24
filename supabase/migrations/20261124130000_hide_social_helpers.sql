-- Sprint 4 review · are_friends and is_blocked_between are internal helpers. Callable by
-- users, they let anyone check who is friends with whom and let a blocked user find out
-- they were blocked. The owner-rights functions and the public_profiles view keep using them.
revoke execute on function public.are_friends(uuid, uuid) from authenticated;
revoke execute on function public.is_blocked_between(uuid, uuid) from authenticated;

-- A view calls functions with the caller's rights, so public_profiles reads blocks directly
-- (tables in a view are read with the owner's rights).
create or replace view public.public_profiles
with (security_invoker = false)
as
  select p.id, p.username, p.display_name, p.avatar_path, p.bio, p.country, p.is_private, p.created_at
  from public.profiles p
  where p.onboarded_at is not null
    and not exists (
      select 1 from public.blocks bl
      where (bl.blocker_id = (select auth.uid()) and bl.blocked_id = p.id)
         or (bl.blocker_id = p.id and bl.blocked_id = (select auth.uid()))
    );
