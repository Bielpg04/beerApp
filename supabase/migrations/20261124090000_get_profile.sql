-- US-104-T1 · Someone's profile as I may see it: public header, how we relate, and a summary
-- of what I can see of their posts. Friends (S4 · US-401) and blocks (US-402) extend it.

create function public.get_profile(user_id uuid)
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
    select p.*, (p.id = uid) as is_me
    from public.profiles p
    where p.id = get_profile.user_id and p.onboarded_at is not null
  ),
  visible as (
    select t.*, (t.is_me or not t.is_private) as sees from target t
  )
  select
    v.id,
    v.username::text,
    v.display_name,
    v.avatar_path,
    v.bio,
    v.is_private,
    case when v.is_me then 'self' else 'none' end,
    v.sees,
    case when v.sees then (
      select count(*)::int from public.posts po
      where po.author_id = v.id and public.can_see_post(po.author_id, po.publish_to_feed)
    ) end,
    case when v.sees then (
      select count(distinct po.beer_id)::int from public.posts po
      where po.author_id = v.id and public.can_see_post(po.author_id, po.publish_to_feed)
    ) end,
    case when v.sees then 0 end
  from visible v;
end;
$$;

revoke execute on function public.get_profile(uuid) from public, anon;
grant execute on function public.get_profile(uuid) to authenticated;
