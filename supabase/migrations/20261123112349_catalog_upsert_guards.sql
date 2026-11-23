-- Sprint 2 review fixes to the catalog write path (see 20261115230636_catalog_upsert.sql):
--  * An existing OFF beer is only updated when a value actually changes, so the monthly
--    import does not bump updated_at on every beer. The ABV is rounded to the stored scale
--    first, or 5.123 vs the stored 5.12 would count as a change every time.
--  * A re-import without a date keeps the barcode's known off_last_modified.
--  * Brewery link: breweries with no country are compared as (name, NULL) pairs instead of
--    being ignored, so one brewery without country links and two of them stay ambiguous.
--  * catalog_register_lookup deletes lookups older than the one-hour window.

create or replace function catalog_import.apply_group(
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
  next_abv numeric;
  next_style text;
  next_image text;
  next_thumb text;
  next_country char(2);
  next_brewery uuid;
begin
  if new_abv is not null and (new_abv < 0 or new_abv > 70) then
    new_abv := null;
  end if;
  -- beers.abv is numeric(4, 2): compare and store at that scale.
  new_abv := round(new_abv, 2);

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

  -- The brewery is only linked when the brand's key points to one brewery. Open Brewery DB
  -- lists big breweries once per site, so several rows with the same name and country count
  -- as one (the lowest obdb_id is used); different names or countries stay ambiguous. A
  -- missing country is a value of its own here (a row with a null field still counts).
  select count(distinct (lower(name), country))
  into brewery_count
  from public.breweries
  where name_key = g ->> 'brandKey';
  if brewery_count = 1 then
    select * into brewery
    from public.breweries
    where name_key = g ->> 'brandKey'
    order by obdb_id nulls last, id
    limit 1;
  end if;

  created := target.id is null;

  if created then
    -- Two first lookups of the same new beer can race: the loser inserts nothing and
    -- picks up the winner's row below instead of failing on the unique key.
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
    on conflict (brand_key, name_key) where merged_into is null and source = 'off' do nothing
    returning * into target;

    if target.id is null then
      created := false;
      select * into target
      from public.beers
      where brand_key = g ->> 'brandKey'
        and name_key = g ->> 'nameKey'
        and source = 'off'
        and merged_into is null;
    end if;
  end if;

  if not created and target.source = 'off' then
    next_abv := coalesce(new_abv, target.abv);
    next_style := coalesce(nullif(g ->> 'styleCode', ''), target.style_code);
    next_image := coalesce(new_image, target.image_url);
    next_thumb := case when new_image is not null then nullif(g ->> 'imageThumbUrl', '') else target.image_thumb_url end;
    next_country := coalesce(brewery.country, new_country, target.country);
    next_brewery := coalesce(brewery.id, target.brewery_id);

    update public.beers
    set abv = next_abv,
        style_code = next_style,
        image_url = next_image,
        image_thumb_url = next_thumb,
        country = next_country,
        brewery_id = next_brewery
    where id = target.id
      and (abv, style_code, image_url, image_thumb_url, country, brewery_id)
        is distinct from (next_abv, next_style, next_image, next_thumb, next_country, next_brewery);
  end if;

  beer_id := target.id;

  -- New barcodes go to this beer; known ones keep their beer and only refresh the date
  -- (a group without a date keeps the one already known).
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
    on conflict (barcode) do update
      set off_last_modified = coalesce(excluded.off_last_modified, beer_barcodes.off_last_modified)
    returning (xmax = 0) as inserted
  )
  select count(*) filter (where inserted) into barcodes_added from upserted;
end;
$$;

create or replace function public.catalog_register_lookup(uid uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Only the last hour matters: drop older lookups of every user so the table stays small.
  delete from catalog_import.lookups where created_at <= now() - interval '1 hour';

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
