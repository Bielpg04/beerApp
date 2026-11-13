-- US-103-T1 · User profiles.
-- One row per auth user, created automatically on sign-up. Sensitive fields
-- (birthdate) are only readable by the owner; everyone else reads public_profiles.
-- username, birthdate, country and onboarded_at are set through onboarding
-- functions (US-102), never by a direct update from the client.

create extension if not exists citext with schema extensions;

-- ---------- username rules ----------

create function public.is_valid_username(candidate text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select candidate is not null
    and candidate ~ '^[a-z0-9_.]{3,20}$'
    and left(candidate, 1) <> '.'
    and right(candidate, 1) <> '.';
$$;

comment on function public.is_valid_username(text) is
  '3–20 chars of a-z 0-9 _ . ; cannot start or end with a dot.';

-- ---------- table ----------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username extensions.citext unique
    check (username is null or public.is_valid_username(username::text)), -- null until onboarding
  display_name text check (char_length(display_name) between 1 and 50),
  avatar_path text,
  bio text check (char_length(bio) <= 160),
  birthdate date,
  country char(2) check (country ~ '^[A-Z]{2}$'),
  is_private boolean not null default false,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'One profile per user. birthdate is private to its owner.';

-- ---------- triggers ----------

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')), 50), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------- permissions ----------

alter table public.profiles enable row level security;

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, bio, avatar_path, is_private) on public.profiles to authenticated;

create policy "Users read their own profile"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy "Users update their own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------- public view ----------

-- Runs with the owner's rights (bypasses RLS) and exposes only public columns.
create view public.public_profiles
with (security_invoker = false)
as
  select id, username, display_name, avatar_path, bio, country, is_private, created_at
  from public.profiles;

revoke all on public.public_profiles from anon, authenticated;
grant select on public.public_profiles to authenticated;

-- ---------- live username check ----------

create function public.username_available(candidate text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_valid_username(candidate)
    and not exists (select 1 from public.profiles p where p.username = candidate::extensions.citext);
$$;

revoke execute on function public.username_available(text) from public, anon;
grant execute on function public.username_available(text) to authenticated;
