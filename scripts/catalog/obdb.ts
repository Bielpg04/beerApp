/** Open Brewery DB → public.breweries (Europe + United States). */
import type { Sql } from 'postgres';

import { IN_SCOPE, brandKey, countryFromName } from '../../supabase/functions/_shared/catalog/index.ts';

const API = 'https://api.openbrewerydb.org/v1/breweries';
const PAGE_SIZE = 200;

export type ObdbBrewery = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  longitude: number | null;
  latitude: number | null;
  website_url: string | null;
};

export type BreweryRow = {
  obdb_id: string;
  name: string;
  name_key: string;
  country: string;
  city: string | null;
  website: string | null;
  longitude: number | null;
  latitude: number | null;
};

type Fetch = (url: string) => Promise<Response>;

export async function* fetchBreweries(fetchImpl: Fetch = fetch): AsyncGenerator<ObdbBrewery> {
  for (let page = 1; ; page++) {
    const res = await fetchImpl(`${API}?per_page=${PAGE_SIZE}&page=${page}`);
    if (!res.ok) throw new Error(`Open Brewery DB page ${page}: HTTP ${res.status}`);
    const items = (await res.json()) as ObdbBrewery[];
    if (items.length === 0) return;
    yield* items;
  }
}

export function toBreweryRow(b: ObdbBrewery): BreweryRow | null {
  const name = b.name?.trim();
  const country = countryFromName(b.country ?? '');
  if (!name || !country || !IN_SCOPE.has(country)) return null;
  const hasPoint = typeof b.longitude === 'number' && typeof b.latitude === 'number';
  return {
    obdb_id: b.id,
    name,
    name_key: brandKey(name),
    country,
    city: b.city?.trim() || null,
    website: b.website_url?.trim() || null,
    longitude: hasPoint ? b.longitude : null,
    latitude: hasPoint ? b.latitude : null,
  };
}

/** Upserts by obdb_id in batches; returns how many rows were written. */
export async function upsertBreweries(sql: Sql, rows: BreweryRow[]): Promise<number> {
  let written = 0;
  for (let i = 0; i < rows.length; i += 1000) {
    const batch = rows.slice(i, i + 1000);
    await sql`
      insert into public.breweries (obdb_id, name, name_key, country, city, website, location, source)
      select r.obdb_id, r.name, r.name_key, r.country, r.city, r.website,
             case when r.longitude is not null
               then extensions.st_setsrid(extensions.st_makepoint(r.longitude, r.latitude), 4326)::extensions.geography
             end,
             'obdb'
      from jsonb_to_recordset(${sql.json(batch)}) as r(
        obdb_id text, name text, name_key text, country text, city text, website text,
        longitude double precision, latitude double precision
      )
      on conflict (obdb_id) do update set
        name = excluded.name, name_key = excluded.name_key, country = excluded.country,
        city = excluded.city, website = excluded.website, location = excluded.location`;
    written += batch.length;
  }
  return written;
}

export async function importObdb(
  sql: Sql | null,
): Promise<{ read: number; inScope: number; written: number }> {
  let read = 0;
  const rows: BreweryRow[] = [];
  for await (const b of fetchBreweries()) {
    read++;
    const row = toBreweryRow(b);
    if (row) rows.push(row);
  }
  const written = sql ? await upsertBreweries(sql, rows) : 0;
  return { read, inScope: rows.length, written };
}
