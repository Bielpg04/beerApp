-- set_birthdate must fail loudly when the caller has no profile row (e.g. the account was
-- deleted while a session token is still alive) instead of silently updating nothing.
create or replace function public.set_birthdate(birthdate date, country text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  code text := upper(trim(country));
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if code !~ '^[A-Z]{2}$' then
    raise exception 'invalid_country' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.profiles p where p.id = uid and p.onboarded_at is not null) then
    raise exception 'already_onboarded' using errcode = 'P0001';
  end if;
  if birthdate > (current_date - make_interval(years => public.min_drinking_age(code)))::date then
    raise exception 'underage' using errcode = 'P0001';
  end if;

  update public.profiles p
     set birthdate = set_birthdate.birthdate, country = code
   where p.id = uid;
  if not found then
    raise exception 'profile_not_found' using errcode = 'P0001';
  end if;
end;
$$;
