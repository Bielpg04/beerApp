-- US-102-T2 · Onboarding with the legal drinking age validated on the server.
-- Step 1: set_birthdate(birthdate, country) — rejects users under the legal age.
-- Step 2: complete_profile(username, display_name) — marks the profile as onboarded.
-- After onboarding, birthdate and country can no longer change.

create table public.legal_drinking_age (
  country char(2) primary key check (country ~ '^[A-Z]{2}$'),
  min_age smallint not null check (min_age between 0 and 30)
);

comment on table public.legal_drinking_age is 'Countries whose minimum age differs from the default 18.';

insert into public.legal_drinking_age (country, min_age) values ('US', 21);

alter table public.legal_drinking_age enable row level security;
grant select on public.legal_drinking_age to authenticated;
create policy "Anyone signed in can read drinking ages"
  on public.legal_drinking_age for select to authenticated using (true);

create function public.min_drinking_age(country text)
returns smallint
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select l.min_age from public.legal_drinking_age l where l.country = upper(min_drinking_age.country)),
    18::smallint
  );
$$;

-- ---------- step 1: age ----------

create function public.set_birthdate(birthdate date, country text)
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
end;
$$;

-- ---------- step 2: profile ----------

create function public.complete_profile(username text, display_name text)
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
           onboarded_at = coalesce(p.onboarded_at, now())
     where p.id = uid;
  exception when unique_violation then
    raise exception 'username_taken' using errcode = 'P0001';
  end;
end;
$$;

-- ---------- lock age data after onboarding ----------

create function public.lock_onboarding_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.onboarded_at is not null
     and (new.birthdate is distinct from old.birthdate or new.country is distinct from old.country) then
    raise exception 'already_onboarded' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger profiles_lock_onboarding_fields
  before update on public.profiles
  for each row execute function public.lock_onboarding_fields();

-- ---------- permissions ----------

revoke execute on function public.set_birthdate(date, text) from public, anon;
revoke execute on function public.complete_profile(text, text) from public, anon;
revoke execute on function public.min_drinking_age(text) from public, anon;
grant execute on function public.set_birthdate(date, text) to authenticated;
grant execute on function public.complete_profile(text, text) to authenticated;
grant execute on function public.min_drinking_age(text) to authenticated;
