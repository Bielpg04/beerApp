-- US-201-T4 · One write path into the catalog, shared by the bulk importer and the
-- beer-lookup Edge Function. A "group" is one beer as built by
-- supabase/functions/_shared/catalog (BeerGroup, camelCase keys).
--
-- Re-import policy:
--  * A beer is found by any of its barcodes first (so its id survives renames), then by
--    (brand_key, name_key); otherwise it is created.
--  * name, brand and the keys of an existing beer never change.
--  * abv, style, image, country and brewery are updated when the new value is not null.
--  * Beers created by users (source = 'user') are never changed.
--  * Nothing is ever deleted; duplicates are merged by hand with merge_beers().

-- ---------- staging and bookkeeping ----------

create table catalog_import.staged_groups (
  id bigint generated always as identity primary key,
  payload jsonb not null
);

create table catalog_import.conflicts (
  id bigint generated always as identity primary key,
  barcodes text[] not null,
  beer_ids uuid[] not null,
  seen_at timestamptz not null default now()
);

comment on table catalog_import.conflicts is
  'Groups whose barcodes already belonged to several beers. Review and fix with catalog_import.merge_beers().';

create table catalog_import.lookups (
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index lookups_user_time_idx on catalog_import.lookups (user_id, created_at);

-- ---------- upsert ----------

create function catalog_import.apply_group(
  g jsonb,
  out beer_id uuid,
  out created boolean,
  out barcodes_added int,
  out conflict boolean
)
language plpgsql
set search_path = ''
as $$
declare
  codes text[];
  owners uuid[];
  target public.beers;
  brewery public.breweries;
  brewery_count int;
  new_abv numeric := nullif(g ->> 'abv', '')::numeric;
  new_country char(2) := nullif(g ->> 'country', '');
  new_image text := nullif(g ->> 'imageUrl', '');
begin
  if new_abv is not null and (new_abv < 0 or new_abv > 70) then
    new_abv := null;
  end if;

  select coalesce(array_agg(distinct c), '{}')
  into codes
  from (
    select public.normalize_gtin(b ->> 'code') as c
    from jsonb_array_elements(coalesce(g -> 'barcodes', '[]')) b
  ) s
  where c is not null;

  -- Final beers that already own one of these barcodes, oldest first.
  select coalesce(array_agg(f.id order by f.created_at, f.id), '{}')
  into owners
  from (
    select distinct b.id, b.created_at
    from public.beer_barcodes bc
    join public.beers b on b.id = public.resolve_beer(bc.beer_id)
    where bc.barcode = any (codes)
  ) f;

  conflict := cardinality(owners) > 1;
  if conflict then
    insert into catalog_import.conflicts (barcodes, beer_ids) values (codes, owners);
  end if;

  if cardinality(owners) > 0 then
    select * into target from public.beers where id = owners[1];
  else
    select * into target
    from public.beers
    where brand_key = g ->> 'brandKey'
      and name_key = g ->> 'nameKey'
      and source = 'off'
      and merged_into is null;
  end if;

  -- The brewery is only linked when exactly one brewery has the brand's key.
  select count(*) into brewery_count from public.breweries where name_key = g ->> 'brandKey';
  if brewery_count = 1 then
    select * into brewery from public.breweries where name_key = g ->> 'brandKey';
  end if;

  created := target.id is null;

  if created then
    insert into public.beers (
      name, name_key, brand, brand_key, brewery_id, style_code, abv, country,
      image_url, image_thumb_url, source, status
    )
    values (
      g ->> 'name', g ->> 'nameKey', g ->> 'brand', g ->> 'brandKey', brewery.id,
      nullif(g ->> 'styleCode', ''), new_abv, coalesce(brewery.country, new_country),
      new_image, case when new_image is not null then nullif(g ->> 'imageThumbUrl', '') end,
      'off', 'approved'
    )
    returning * into target;
  elsif target.source = 'off' then
    update public.beers
    set abv = coalesce(new_abv, abv),
        style_code = coalesce(nullif(g ->> 'styleCode', ''), style_code),
        image_url = coalesce(new_image, image_url),
        image_thumb_url = case
          when new_image is not null then nullif(g ->> 'imageThumbUrl', '')
          else image_thumb_url
        end,
        country = coalesce(brewery.country, new_country, country),
        brewery_id = coalesce(brewery.id, brewery_id)
    where id = target.id;
  end if;

  beer_id := target.id;

  -- New barcodes go to this beer; known ones keep their beer and only refresh the date.
  with incoming as (
    select distinct on (c) c as barcode, nullif(b ->> 'offLastModified', '')::timestamptz as modified
    from jsonb_array_elements(coalesce(g -> 'barcodes', '[]')) b,
         lateral (select public.normalize_gtin(b ->> 'code') as c) n
    where c is not null
    order by c, modified desc nulls last
  ),
  upserted as (
    insert into public.beer_barcodes (barcode, beer_id, off_last_modified)
    select barcode, target.id, modified from incoming
    on conflict (barcode) do update set off_last_modified = excluded.off_last_modified
    returning (xmax = 0) as inserted
  )
  select count(*) filter (where inserted) into barcodes_added from upserted;
end;
$$;

create function catalog_import.upsert_beer(g jsonb)
returns uuid
language sql
set search_path = ''
as $$
  select (catalog_import.apply_group(g)).beer_id;
$$;

create function catalog_import.merge(
  out created int,
  out updated int,
  out barcodes_added int,
  out conflicts int
)
language plpgsql
set search_path = ''
as $$
declare
  row catalog_import.staged_groups;
  r record;
begin
  created := 0;
  updated := 0;
  barcodes_added := 0;
  conflicts := 0;
  for row in select * from catalog_import.staged_groups order by id loop
    r := catalog_import.apply_group(row.payload);
    if r.created then
      created := created + 1;
    else
      updated := updated + 1;
    end if;
    barcodes_added := barcodes_added + r.barcodes_added;
    if r.conflict then
      conflicts := conflicts + 1;
    end if;
  end loop;
  delete from catalog_import.staged_groups;
end;
$$;

create function catalog_import.merge_beers(from_id uuid, into_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  final_id uuid := public.resolve_beer(into_id);
begin
  if final_id is null or from_id = final_id then
    raise exception 'cannot merge % into %', from_id, into_id;
  end if;
  update public.beer_barcodes set beer_id = final_id where beer_id = from_id;
  update public.beers set merged_into = final_id where id = from_id;
end;
$$;

-- ---------- entry points for the Edge Function (service_role only) ----------

create function public.catalog_upsert_beer(g jsonb)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select catalog_import.upsert_beer(g);
$$;

create function public.catalog_register_lookup(uid uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Serialize per user so two concurrent lookups cannot both take the last slot.
  perform pg_advisory_xact_lock(hashtext('catalog_lookup:' || uid::text));
  if (
    select count(*) from catalog_import.lookups
    where user_id = uid and created_at > now() - interval '1 hour'
  ) >= 30 then
    return false;
  end if;
  insert into catalog_import.lookups (user_id) values (uid);
  return true;
end;
$$;

revoke execute on function public.catalog_upsert_beer(jsonb), public.catalog_register_lookup(uuid)
  from public, anon, authenticated;
grant execute on function public.catalog_upsert_beer(jsonb), public.catalog_register_lookup(uuid)
  to service_role;
