-- US-402-T1 · Blocking users (App Store guideline 1.2).
-- A block cuts every tie both ways: the friendship goes, neither sees the other's posts,
-- photos or profile, neither finds the other, and no requests. The blocked user is never told:
-- for them the blocker simply does not exist. Tags (S6) must also check is_blocked_between.

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index blocks_blocked_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;
revoke all on public.blocks from anon, authenticated;
grant select on public.blocks to authenticated;

create policy "Users read the blocks they made" on public.blocks
  for select to authenticated
  using (blocker_id = (select auth.uid()));

create function public.is_blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks bl
    where (bl.blocker_id = a and bl.blocked_id = b) or (bl.blocker_id = b and bl.blocked_id = a)
  );
$$;

revoke execute on function public.is_blocked_between(uuid, uuid) from public, anon;
grant execute on function public.is_blocked_between(uuid, uuid) to authenticated;

-- ---------- visibility ----------

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
      and not public.is_blocked_between((select auth.uid()), author)
      and exists (
        select 1 from public.profiles p
        where p.id = author
          and p.onboarded_at is not null
          and (not p.is_private or public.are_friends((select auth.uid()), author))
      )
    );
$$;

create or replace view public.public_profiles
with (security_invoker = false)
as
  select id, username, display_name, avatar_path, bio, country, is_private, created_at
  from public.profiles
  where onboarded_at is not null
    and not public.is_blocked_between((select auth.uid()), id);

-- ---------- get_profile: blocked ----------

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

  -- They blocked me: they do not exist for me.
  if exists (select 1 from public.blocks bl where bl.blocker_id = get_profile.user_id and bl.blocked_id = uid) then
    return;
  end if;

  return query
  with target as (
    select p.*,
      case
        when p.id = uid then 'self'
        when exists (select 1 from public.blocks bl where bl.blocker_id = uid and bl.blocked_id = p.id) then 'blocked'
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
    select t.*, (t.rel in ('self', 'friends') or (t.rel <> 'blocked' and not t.is_private)) as sees from target t
  )
  select
    v.id,
    v.username::text,
    v.display_name,
    case when v.rel <> 'blocked' then v.avatar_path end,
    case when v.rel <> 'blocked' then v.bio end,
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

-- ---------- requests and search respect blocks ----------

create or replace function public.send_friend_request(user_id uuid)
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
  if not exists (select 1 from public.profiles p where p.id = other and p.onboarded_at is not null)
     or public.is_blocked_between(uid, other) then
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

create or replace function public.find_people(q text, max int default 20)
returns table (id uuid, username text, display_name text, avatar_path text, relationship text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  term text := lower(regexp_replace(coalesce(q, ''), '[@\s]', '', 'g'));
  pattern text;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if char_length(term) < 2 then
    return;
  end if;
  pattern := replace(replace(replace(term, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
  select
    p.id,
    p.username::text,
    p.display_name,
    p.avatar_path,
    case
      when f.status = 'accepted' then 'friends'
      when f.status = 'pending' and f.requested_by = uid then 'outgoing'
      when f.status = 'pending' then 'incoming'
      else 'none'
    end
  from public.profiles p
  left join public.friendships f
    on f.user_low = least(p.id, uid) and f.user_high = greatest(p.id, uid)
  where p.onboarded_at is not null
    and p.id <> uid
    and lower(p.username::text) like pattern escape '\'
    and not public.is_blocked_between(uid, p.id)
  order by (lower(p.username::text) = term) desc, p.username
  limit least(greatest(coalesce(max, 20), 1), 20);
end;
$$;

-- ---------- block / unblock ----------

create function public.block_user(user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  other uuid := block_user.user_id;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if other = uid then
    raise exception 'cannot_block_self' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profiles p where p.id = other) then
    raise exception 'user_not_found' using errcode = 'P0001';
  end if;

  delete from public.friendships
   where user_low = least(uid, other) and user_high = greatest(uid, other);
  insert into public.blocks (blocker_id, blocked_id) values (uid, other)
  on conflict do nothing;
end;
$$;

/** Removes my block. The friendship it ended does not come back. */
create function public.unblock_user(user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  delete from public.blocks where blocker_id = auth.uid() and blocked_id = unblock_user.user_id;
end;
$$;

create function public.my_blocked_users()
returns table (id uuid, username text, display_name text, avatar_path text, blocked_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username::text, p.display_name, p.avatar_path, bl.created_at
  from public.blocks bl
  join public.profiles p on p.id = bl.blocked_id
  where bl.blocker_id = (select auth.uid())
  order by bl.created_at desc, p.id;
$$;

revoke execute on function public.block_user(uuid), public.unblock_user(uuid), public.my_blocked_users()
from public, anon;
grant execute on function public.block_user(uuid), public.unblock_user(uuid), public.my_blocked_users()
to authenticated;
