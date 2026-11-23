-- US-303-T1 · Editing a post. Only its author; only serving, volume, caption, date and feed.
-- The beer and the photo never change (verification will depend on them, S9).
-- A verified post keeps its date. is_retroactive can become true (date moved more than 1 h
-- before the post was created) but never goes back to false.
create function public.update_post(
  post_id uuid,
  serving text,
  volume_ml int,
  caption text,
  consumed_at timestamptz,
  publish_to_feed boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  post public.posts;
  clean_caption text := nullif(trim(update_post.caption), '');
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select * into post from public.posts p where p.id = update_post.post_id and p.author_id = uid for update;
  if not found then
    raise exception 'post_not_found' using errcode = 'P0001';
  end if;

  if update_post.serving is null or update_post.serving not in ('tap', 'bottle', 'can') then
    raise exception 'invalid_serving' using errcode = 'P0001';
  end if;
  if update_post.volume_ml is not null and update_post.volume_ml not between 50 and 5000 then
    raise exception 'invalid_volume' using errcode = 'P0001';
  end if;
  if char_length(clean_caption) > 500 then
    raise exception 'invalid_caption' using errcode = 'P0001';
  end if;
  if update_post.consumed_at is null or update_post.consumed_at > now() + interval '5 minutes' then
    raise exception 'consumed_in_future' using errcode = 'P0001';
  end if;
  if update_post.consumed_at < '2000-01-01T00:00:00Z'::timestamptz then
    raise exception 'consumed_too_old' using errcode = 'P0001';
  end if;
  if post.verification_level = 'verified' and update_post.consumed_at is distinct from post.consumed_at then
    raise exception 'locked_by_verification' using errcode = 'P0001';
  end if;

  update public.posts p
  set serving = update_post.serving,
      volume_ml = update_post.volume_ml,
      caption = clean_caption,
      consumed_at = update_post.consumed_at,
      publish_to_feed = coalesce(update_post.publish_to_feed, p.publish_to_feed),
      is_retroactive = p.is_retroactive or update_post.consumed_at < p.created_at - interval '1 hour'
  where p.id = post.id;
end;
$$;

revoke execute on function public.update_post(uuid, text, int, text, timestamptz, boolean) from public, anon;
grant execute on function public.update_post(uuid, text, int, text, timestamptz, boolean) to authenticated;
