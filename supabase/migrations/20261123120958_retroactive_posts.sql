-- US-302-T3 · Past posts. create_post now takes when the beer was drunk (default: now) and
-- whether it goes to the feed (default: only if drunk in the last 48 h). A post drunk more than
-- 1 h before it is published is retroactive. photo stays the 5th parameter so existing calls keep working.

drop function public.create_post(uuid, text, int, text, jsonb);

create function public.create_post(
  beer_id uuid,
  serving text,
  volume_ml int default null,
  caption text default null,
  photo jsonb default null,
  consumed_at timestamptz default null,
  publish_to_feed boolean default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  final_beer uuid;
  clean_caption text := nullif(trim(create_post.caption), '');
  photo_path text := photo ->> 'path';
  photo_thumb text := photo ->> 'thumbPath';
  drunk_at timestamptz := coalesce(create_post.consumed_at, now());
  new_id uuid;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles p where p.id = uid and p.onboarded_at is not null) then
    raise exception 'not_onboarded' using errcode = 'P0001';
  end if;

  final_beer := public.resolve_beer(create_post.beer_id);
  if final_beer is null or not exists (
    select 1 from public.beers b
    where b.id = final_beer and (b.status = 'approved' or b.created_by = uid)
  ) then
    raise exception 'beer_not_found' using errcode = 'P0001';
  end if;

  if create_post.serving is null or create_post.serving not in ('tap', 'bottle', 'can') then
    raise exception 'invalid_serving' using errcode = 'P0001';
  end if;
  if create_post.volume_ml is not null and create_post.volume_ml not between 50 and 5000 then
    raise exception 'invalid_volume' using errcode = 'P0001';
  end if;
  if char_length(clean_caption) > 500 then
    raise exception 'invalid_caption' using errcode = 'P0001';
  end if;

  -- A few minutes of tolerance for phones whose clock runs ahead.
  if drunk_at > now() + interval '5 minutes' then
    raise exception 'consumed_in_future' using errcode = 'P0001';
  end if;
  if drunk_at < '2000-01-01T00:00:00Z'::timestamptz then
    raise exception 'consumed_too_old' using errcode = 'P0001';
  end if;

  if photo is not null then
    if coalesce(photo ->> 'source', '') not in ('camera', 'library')
       or coalesce((photo ->> 'width')::int, 0) <= 0
       or coalesce((photo ->> 'height')::int, 0) <= 0 then
      raise exception 'invalid_photo' using errcode = 'P0001';
    end if;
    if (
      select count(*) from storage.objects o
      where o.bucket_id = 'post-photos'
        and o.name in (photo_path, photo_thumb)
        and o.owner_id = uid::text
        and (storage.foldername(o.name))[1] = uid::text
    ) <> 2 or photo_path = photo_thumb then
      raise exception 'photo_not_found' using errcode = 'P0001';
    end if;
    if exists (
      select 1 from public.post_photos pp
      where pp.path in (photo_path, photo_thumb) or pp.thumb_path in (photo_path, photo_thumb)
    ) then
      raise exception 'photo_in_use' using errcode = 'P0001';
    end if;
  end if;

  insert into public.posts (
    author_id, beer_id, serving, volume_ml, caption, consumed_at, is_retroactive, publish_to_feed
  )
  values (
    uid, final_beer, create_post.serving, create_post.volume_ml, clean_caption, drunk_at,
    drunk_at < now() - interval '1 hour',
    coalesce(create_post.publish_to_feed, drunk_at >= now() - interval '48 hours')
  )
  returning id into new_id;

  if photo is not null then
    insert into public.post_photos (post_id, path, thumb_path, source, exif_taken_at, width, height)
    values (
      new_id, photo_path, photo_thumb, photo ->> 'source',
      nullif(photo ->> 'exifTakenAt', '')::timestamptz,
      (photo ->> 'width')::int, (photo ->> 'height')::int
    );
  end if;

  return new_id;
end;
$$;

revoke execute on function public.create_post(uuid, text, int, text, jsonb, timestamptz, boolean) from public, anon;
grant execute on function public.create_post(uuid, text, int, text, jsonb, timestamptz, boolean) to authenticated;
