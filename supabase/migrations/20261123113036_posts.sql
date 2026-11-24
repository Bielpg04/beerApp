-- US-301-T1 · Posts (a beer someone drank) and their photos.
-- Created only through create_post(), which fills the fields the client must not choose
-- (author, is_retroactive, verification_level). Read and deleted through RLS.
-- Who sees a post: its author always; others only if it is published to the feed and the
-- author's profile is public (friends join in S4).

-- ---------- tables ----------

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  beer_id uuid not null references public.beers (id),
  serving text not null check (serving in ('tap', 'bottle', 'can')),
  volume_ml smallint check (volume_ml between 50 and 5000),
  caption text check (char_length(caption) between 1 and 500),
  consumed_at timestamptz not null,
  is_retroactive boolean not null default false,
  publish_to_feed boolean not null default true,
  verification_level text not null default 'unverified'
    check (verification_level in ('verified', 'partial', 'unverified')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.posts.beer_id is 'The final beer (merged_into followed) when the post was created.';
comment on column public.posts.verification_level is 'Computed on the server (S9). Always unverified until then.';

create index posts_author_consumed_idx on public.posts (author_id, consumed_at desc);
create index posts_beer_idx on public.posts (beer_id);

create trigger posts_set_updated_at
  before update on public.posts
  for each row execute function public.set_updated_at();

create table public.post_photos (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null unique references public.posts (id) on delete cascade, -- one photo per post, for now
  path text not null unique,
  thumb_path text not null unique,
  source text not null check (source in ('camera', 'library')),
  exif_taken_at timestamptz,
  width smallint not null check (width > 0),
  height smallint not null check (height > 0),
  created_at timestamptz not null default now()
);

comment on column public.post_photos.source is 'Declared by the client; proves nothing until verification (S9).';

-- ---------- visibility ----------

-- profiles is only readable by its owner, so the author's privacy is checked with owner rights.
create function public.can_see_post(author uuid, published boolean)
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
        where p.id = author and not p.is_private and p.onboarded_at is not null
      )
    );
$$;

revoke execute on function public.can_see_post(uuid, boolean) from public, anon;
grant execute on function public.can_see_post(uuid, boolean) to authenticated;

-- ---------- permissions ----------

alter table public.posts enable row level security;
alter table public.post_photos enable row level security;

revoke all on public.posts, public.post_photos from anon, authenticated;
grant select, delete on public.posts to authenticated;
grant select on public.post_photos to authenticated;

create policy "Users read the posts they may see" on public.posts
  for select to authenticated using (public.can_see_post(author_id, publish_to_feed));

create policy "Authors delete their own posts" on public.posts
  for delete to authenticated using (author_id = (select auth.uid()));

-- RLS on posts applies inside the subquery: a photo is visible when its post is.
create policy "Users read the photos of posts they may see" on public.post_photos
  for select to authenticated using (exists (select 1 from public.posts p where p.id = post_id));

-- ---------- storage ----------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-photos', 'post-photos', false, 2097152, array['image/jpeg']);

create policy "Users upload post photos into their own folder"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'post-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users delete their own post photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'post-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users read their own post photos and those of posts they may see"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'post-photos'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (select 1 from public.post_photos pp where pp.path = name or pp.thumb_path = name)
    )
  );

-- ---------- create_post ----------

create function public.create_post(
  beer_id uuid,
  serving text,
  volume_ml int default null,
  caption text default null,
  photo jsonb default null
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

  insert into public.posts (author_id, beer_id, serving, volume_ml, caption, consumed_at)
  values (uid, final_beer, create_post.serving, create_post.volume_ml, clean_caption, now())
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

revoke execute on function public.create_post(uuid, text, int, text, jsonb) from public, anon;
grant execute on function public.create_post(uuid, text, int, text, jsonb) to authenticated;
