-- US-401-T1 · Mutual friendships with requests.
-- One row per pair (user_low < user_high). Written only through the functions below, so
-- nobody can accept on someone else's behalf. Friends see each other's published posts even
-- when the profile is private.

create table public.friendships (
  user_low uuid not null references public.profiles (id) on delete cascade,
  user_high uuid not null references public.profiles (id) on delete cascade,
  requested_by uuid not null,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (user_low, user_high),
  check (user_low < user_high),
  check (requested_by in (user_low, user_high)),
  check ((status = 'accepted') = (accepted_at is not null))
);

comment on table public.friendships is 'One row per pair; pending until the other user accepts.';

create index friendships_user_high_idx on public.friendships (user_high);

alter table public.friendships enable row level security;
revoke all on public.friendships from anon, authenticated;
grant select on public.friendships to authenticated;

create policy "Users read their own friendships" on public.friendships
  for select to authenticated
  using ((select auth.uid()) in (user_low, user_high));

-- ---------- helpers ----------

create function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.friendships f
    where f.user_low = least(a, b) and f.user_high = greatest(a, b) and f.status = 'accepted'
  );
$$;

revoke execute on function public.are_friends(uuid, uuid) from public, anon;
grant execute on function public.are_friends(uuid, uuid) to authenticated;

-- Friends now see published posts of private profiles.
create or replace function public.can_see_post(author uuid, published boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select author = (select auth.uid())
    or (
      published
      and exists (
        select 1 from public.profiles p
        where p.id = author
          and p.onboarded_at is not null
          and (not p.is_private or public.are_friends((select auth.uid()), author))
      )
    );
$$;

-- ---------- get_profile: friendship states ----------

create or replace function public.get_profile(user_id uuid)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_path text,
  bio text,
  is_private boolean,
  relationship text,
  can_see_posts boolean,
  posts_count int,
  beers_count int,
  friends_count int
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  return query
  with target as (
    select p.*,
      case
        when p.id = uid then 'self'
        when f.status = 'accepted' then 'friends'
        when f.status = 'pending' and f.requested_by = uid then 'outgoing'
        when f.status = 'pending' then 'incoming'
        else 'none'
      end as rel
    from public.profiles p
    left join public.friendships f
      on f.user_low = least(p.id, uid) and f.user_high = greatest(p.id, uid)
    where p.id = get_profile.user_id and p.onboarded_at is not null
  ),
  visible as (
    select t.*, (t.rel in ('self', 'friends') or not t.is_private) as sees from target t
  )
  select
    v.id,
    v.username::text,
    v.display_name,
    v.avatar_path,
    v.bio,
    v.is_private,
    v.rel,
    v.sees,
    case when v.sees then (
      select count(*)::int from public.posts po
      where po.author_id = v.id and public.can_see_post(po.author_id, po.publish_to_feed)
    ) end,
    case when v.sees then (
      select count(distinct po.beer_id)::int from public.posts po
      where po.author_id = v.id and public.can_see_post(po.author_id, po.publish_to_feed)
    ) end,
    case when v.sees then (
      select count(*)::int from public.friendships f
      where f.status = 'accepted' and v.id in (f.user_low, f.user_high)
    ) end
  from visible v;
end;
$$;

-- ---------- writes ----------

/** Sends a request, or accepts theirs if they had already asked. Returns pending | accepted. */
create function public.send_friend_request(user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  other uuid := send_friend_request.user_id;
  f public.friendships%rowtype;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if other = uid then
    raise exception 'cannot_befriend_self' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profiles p where p.id = other and p.onboarded_at is not null) then
    raise exception 'user_not_found' using errcode = 'P0001';
  end if;

  insert into public.friendships (user_low, user_high, requested_by)
  values (least(uid, other), greatest(uid, other), uid)
  on conflict do nothing;

  select * into f from public.friendships
  where user_low = least(uid, other) and user_high = greatest(uid, other)
  for update;

  if f.status = 'pending' and f.requested_by <> uid then
    update public.friendships
       set status = 'accepted', accepted_at = now()
     where user_low = f.user_low and user_high = f.user_high;
    return 'accepted';
  end if;
  return f.status;
end;
$$;

create function public.accept_friend_request(user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  other uuid := accept_friend_request.user_id;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  update public.friendships
     set status = 'accepted', accepted_at = now()
   where user_low = least(uid, other) and user_high = greatest(uid, other)
     and status = 'pending' and requested_by = other;
  if not found then
    raise exception 'request_not_found' using errcode = 'P0001';
  end if;
end;
$$;

create function public.decline_friend_request(user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  other uuid := decline_friend_request.user_id;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  delete from public.friendships
   where user_low = least(uid, other) and user_high = greatest(uid, other)
     and status = 'pending' and requested_by = other;
  if not found then
    raise exception 'request_not_found' using errcode = 'P0001';
  end if;
end;
$$;

/** Cancels the request I sent or ends a friendship. Nothing to remove is fine. */
create function public.remove_friend(user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  other uuid := remove_friend.user_id;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  delete from public.friendships
   where user_low = least(uid, other) and user_high = greatest(uid, other)
     and (status = 'accepted' or requested_by = uid);
end;
$$;

-- ---------- lists ----------

create function public.my_friends()
returns table (id uuid, username text, display_name text, avatar_path text, since timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username::text, p.display_name, p.avatar_path, f.accepted_at
  from public.friendships f
  join public.profiles p
    on p.id = case when f.user_low = (select auth.uid()) then f.user_high else f.user_low end
  where f.status = 'accepted'
    and (select auth.uid()) in (f.user_low, f.user_high)
    and p.onboarded_at is not null
  order by lower(coalesce(p.display_name, p.username::text)), p.id;
$$;

create function public.my_friend_requests()
returns table (id uuid, username text, display_name text, avatar_path text, requested_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username::text, p.display_name, p.avatar_path, f.created_at
  from public.friendships f
  join public.profiles p on p.id = f.requested_by
  where f.status = 'pending'
    and f.requested_by <> (select auth.uid())
    and (select auth.uid()) in (f.user_low, f.user_high)
    and p.onboarded_at is not null
  order by f.created_at desc, p.id;
$$;

revoke execute on function
  public.send_friend_request(uuid), public.accept_friend_request(uuid), public.decline_friend_request(uuid),
  public.remove_friend(uuid), public.my_friends(), public.my_friend_requests()
from public, anon;
grant execute on function
  public.send_friend_request(uuid), public.accept_friend_request(uuid), public.decline_friend_request(uuid),
  public.remove_friend(uuid), public.my_friends(), public.my_friend_requests()
to authenticated;
