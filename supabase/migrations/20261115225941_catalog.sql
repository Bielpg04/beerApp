-- US-201-T1 · Beer catalog.
-- Read-only for signed-in users. Only the importer (direct Postgres connection) and
-- the beer-lookup Edge Function (service_role, through catalog_import functions) write.
-- Beer ids are stable: posts (S3) will reference them, so beers are never deleted;
-- duplicates are redirected with merged_into instead.

-- ---------- helpers ----------

-- unaccent() is only stable; an immutable wrapper is needed to index it.
create function public.f_unaccent(value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, value);
$$;

-- Barcodes are stored as GTIN: EAN-13 (UPC-A gets a leading 0) or EAN-8.
-- Returns null when the code is not a valid GTIN (length or check digit).
create function public.normalize_gtin(code text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  digits text := regexp_replace(coalesce(code, ''), '[^0-9]', '', 'g');
  total int := 0;
  len int;
begin
  if length(digits) = 12 then
    digits := '0' || digits;
  elsif length(digits) = 14 and left(digits, 1) = '0' then
    digits := right(digits, 13);
  end if;

  len := length(digits);
  if len not in (8, 13) then
    return null;
  end if;

  -- From the right, excluding the check digit: weights 3, 1, 3, 1…
  for i in 1 .. len - 1 loop
    total := total + substr(digits, len - i, 1)::int * (case when i % 2 = 1 then 3 else 1 end);
  end loop;

  if (10 - total % 10) % 10 <> right(digits, 1)::int then
    return null;
  end if;
  return digits;
end;
$$;

-- ---------- tables ----------

create table public.beer_styles (
  code text primary key,
  sort_order smallint not null unique
);

comment on table public.beer_styles is
  'Closed list of styles. Names are translated in the app (beers.styles.<code>); sort_order is the priority when OFF lists several.';

insert into public.beer_styles (code, sort_order)
values
  ('non_alcoholic', 1), ('trappist', 2), ('abbey', 3), ('sour', 4), ('fruit', 5), ('witbier', 6),
  ('wheat', 7), ('ipa', 8), ('pale_ale', 9), ('saison', 10), ('bock', 11), ('stout', 12),
  ('porter', 13), ('pilsner', 14), ('amber', 15), ('blonde', 16), ('dark', 17), ('lager', 18);

create table public.breweries (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  name_key text not null,
  country char(2) check (country ~ '^[A-Z]{2}$'),
  city text,
  website text,
  location extensions.geography(Point, 4326),
  source text not null check (source in ('obdb', 'user')),
  obdb_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index breweries_name_key_idx on public.breweries (name_key);

comment on table public.breweries is 'Breweries from Open Brewery DB. OFF brands are not breweries and never create rows here.';

create table public.beers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  name_key text not null,
  brand text not null check (char_length(brand) between 1 and 200),
  brand_key text not null,
  brewery_id uuid references public.breweries (id) on delete set null,
  style_code text references public.beer_styles (code),
  abv numeric(4, 2) check (abv between 0 and 70),
  country char(2) check (country ~ '^[A-Z]{2}$'),
  image_url text,
  image_thumb_url text,
  source text not null check (source in ('off', 'user')),
  status text not null default 'approved' check (status in ('approved', 'pending')),
  created_by uuid references auth.users (id) on delete set null,
  merged_into uuid references public.beers (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (merged_into is null or merged_into <> id)
);

comment on column public.beers.brand is 'Brand as given by Open Food Facts (often a retailer or the beer itself, not the brewery).';
comment on column public.beers.country is 'Country of origin (brewery or OFF origins), never where it is sold.';
comment on column public.beers.merged_into is 'Set when this row is a duplicate of another beer; readers follow it to the final beer.';

create unique index beers_off_key_idx
  on public.beers (brand_key, name_key)
  where merged_into is null and source = 'off';
create index beers_brewery_idx on public.beers (brewery_id);
create index beers_merged_into_idx on public.beers (merged_into) where merged_into is not null;
create index beers_name_trgm_idx
  on public.beers using gin (public.f_unaccent(lower(name)) extensions.gin_trgm_ops);

create table public.beer_barcodes (
  barcode text primary key check (public.normalize_gtin(barcode) is not distinct from barcode),
  beer_id uuid not null references public.beers (id) on delete cascade,
  off_last_modified timestamptz
);

create index beer_barcodes_beer_idx on public.beer_barcodes (beer_id);

create trigger breweries_set_updated_at
  before update on public.breweries
  for each row execute function public.set_updated_at();

create trigger beers_set_updated_at
  before update on public.beers
  for each row execute function public.set_updated_at();

-- ---------- permissions ----------

alter table public.beer_styles enable row level security;
alter table public.breweries enable row level security;
alter table public.beers enable row level security;
alter table public.beer_barcodes enable row level security;

revoke all on public.beer_styles, public.breweries, public.beers, public.beer_barcodes from anon, authenticated;
grant select on public.beer_styles, public.breweries, public.beers, public.beer_barcodes to authenticated;

create policy "Signed-in users read styles" on public.beer_styles
  for select to authenticated using (true);
create policy "Signed-in users read breweries" on public.breweries
  for select to authenticated using (true);
create policy "Signed-in users read approved beers and their own pending ones" on public.beers
  for select to authenticated using (status = 'approved' or created_by = (select auth.uid()));
create policy "Signed-in users read barcodes" on public.beer_barcodes
  for select to authenticated using (true);

-- ---------- lookups ----------

-- Follows merged_into to the final beer (bounded, in case of a cycle).
create function public.resolve_beer(beer uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_id uuid := beer;
  next_id uuid;
  hops int := 0;
begin
  loop
    select b.merged_into into next_id from public.beers b where b.id = current_id;
    if not found then
      return null;
    end if;
    exit when next_id is null or hops >= 10;
    current_id := next_id;
    hops := hops + 1;
  end loop;
  return current_id;
end;
$$;

create function public.beer_by_barcode(code text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select b.id
  from public.beer_barcodes bc
  join public.beers b on b.id = public.resolve_beer(bc.beer_id)
  where bc.barcode = public.normalize_gtin(code)
    and b.status = 'approved';
$$;

revoke execute on function public.resolve_beer(uuid), public.beer_by_barcode(text) from public, anon;
grant execute on function public.resolve_beer(uuid), public.beer_by_barcode(text) to authenticated;

-- ---------- import area (not exposed to the API) ----------

create schema catalog_import;
revoke all on schema catalog_import from public, anon, authenticated;

comment on schema catalog_import is 'Staging tables and functions for the catalog importer and the beer-lookup Edge Function.';
