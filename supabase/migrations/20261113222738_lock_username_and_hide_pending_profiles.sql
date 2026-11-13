-- Review fixes for Sprint 1.
-- 1. complete_profile is only for finishing onboarding: once onboarded, the username is fixed.
-- 2. public_profiles only lists users who finished onboarding, so abandoned sign-ups and
--    minors rejected at the age step are never visible to other users.

create or replace function public.complete_profile(username text, display_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  name text := trim(display_name);
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles p where p.id = uid and p.onboarded_at is not null) then
    raise exception 'already_onboarded' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profiles p where p.id = uid and p.birthdate is not null) then
    raise exception 'birthdate_required' using errcode = 'P0001';
  end if;
  if not public.is_valid_username(username) then
    raise exception 'invalid_username' using errcode = 'P0001';
  end if;
  if name is null or char_length(name) not between 1 and 50 then
    raise exception 'invalid_display_name' using errcode = 'P0001';
  end if;

  begin
    update public.profiles p
       set username = complete_profile.username,
           display_name = name,
           onboarded_at = now()
     where p.id = uid;
  exception when unique_violation then
    raise exception 'username_taken' using errcode = 'P0001';
  end;
end;
$$;

create or replace view public.public_profiles
with (security_invoker = false)
as
  select id, username, display_name, avatar_path, bio, country, is_private, created_at
  from public.profiles
  where onboarded_at is not null;
