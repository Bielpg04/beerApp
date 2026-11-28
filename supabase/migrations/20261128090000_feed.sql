-- US-501-T1 · The friends feed: my posts and my friends' posts published to the feed,
-- newest published first, with a strict (created_at, id) cursor. Rows come flat (author,
-- beer, photo) because profiles are private. Reactions (US-502) and comments (US-503)
-- fill reaction_counts, my_reaction and comment_count.

create index posts_created_idx on public.posts (created_at desc, id desc);

create function public.get_feed(
  before_created_at timestamptz default null,
  before_id uuid default null,
  max int default 20
)
returns table (
  id uuid,
  author_id uuid,
  author_username text,
  author_display_name text,
  author_avatar_path text,
  beer_id uuid,
  beer_name text,
  beer_brand text,
  beer_image_thumb_url text,
  serving text,
  volume_ml int,
  caption text,
  consumed_at timestamptz,
  created_at timestamptz,
  is_retroactive boolean,
  verification_level text,
  photo_path text,
  photo_thumb_path text,
  photo_width int,
  photo_height int,
  reaction_counts jsonb,
  my_reaction text,
  comment_count int
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
  select
    po.id, po.author_id, pr.username::text, pr.display_name, pr.avatar_path,
    b.id, b.name, b.brand, b.image_thumb_url,
    po.serving, po.volume_ml::int, po.caption, po.consumed_at, po.created_at, po.is_retroactive, po.verification_level,
    ph.path, ph.thumb_path, ph.width::int, ph.height::int,
    '{}'::jsonb, null::text, 0
  from public.posts po
  join public.profiles pr on pr.id = po.author_id
  join public.beers b on b.id = po.beer_id
  left join public.post_photos ph on ph.post_id = po.id
  where po.publish_to_feed
    and (po.author_id = uid or public.are_friends(uid, po.author_id))
    and not public.is_blocked_between(uid, po.author_id)
    and (
      get_feed.before_created_at is null
      or po.created_at < get_feed.before_created_at
      or (po.created_at = get_feed.before_created_at and po.id < get_feed.before_id)
    )
  order by po.created_at desc, po.id desc
  limit least(greatest(coalesce(get_feed.max, 20), 1), 50);
end;
$$;

revoke execute on function public.get_feed(timestamptz, uuid, int) from public, anon;
grant execute on function public.get_feed(timestamptz, uuid, int) to authenticated;
