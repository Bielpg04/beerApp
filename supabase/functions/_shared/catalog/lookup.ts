/**
 * Live barcode lookup (US-204): catalog first, then the Open Food Facts product API.
 * Pure logic with injected dependencies, so Node can test what the Edge Function runs.
 */
import { groupRows } from './group.ts';
import { normalizeGtin } from './gtin.ts';
import { isBeer } from './off.ts';
import type { BeerGroup, LookupResult, OffRow } from './types.ts';

export const USER_AGENT = 'BeerApp/1.0 (https://github.com/Bielpg04/beerApp)';
const OFF_TIMEOUT_MS = 5000;
const FIELDS = [
  'code',
  'product_name',
  'brands',
  'categories_tags',
  'countries_tags',
  'origins_tags',
  'nutriments',
  'alcohol_value',
  'image_front_url',
  'image_front_small_url',
  'unique_scans_n',
  'last_modified_t',
].join(',');

export type LookupDeps = {
  findByBarcode(code: string): Promise<string | null>;
  registerLookup(userId: string): Promise<boolean>;
  fetchOff(code: string): Promise<Response>;
  upsert(group: BeerGroup): Promise<string>;
  timeoutMs?: number;
};

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

export function createFetchOff(fetchImpl: Fetch = fetch): (code: string) => Promise<Response> {
  return (code) =>
    fetchImpl(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${FIELDS}`, {
      headers: { 'User-Agent': USER_AGENT },
    });
}

type OffProduct = {
  code?: string;
  product_name?: string;
  brands?: string;
  categories_tags?: string[];
  countries_tags?: string[];
  origins_tags?: string[];
  nutriments?: { alcohol_100g?: number | string };
  alcohol_value?: number | string;
  image_front_url?: string;
  image_front_small_url?: string;
  unique_scans_n?: number;
  last_modified_t?: number;
};

function toRow(code: string, p: OffProduct): OffRow {
  return {
    code,
    productName: p.product_name?.trim() ?? '',
    brands: p.brands?.trim() ?? '',
    categoriesTags: p.categories_tags ?? [],
    countriesTags: p.countries_tags ?? [],
    originsTags: p.origins_tags ?? [],
    alcohol100g: String(p.nutriments?.alcohol_100g ?? p.alcohol_value ?? ''),
    imageUrl: p.image_front_url ?? '',
    imageSmallUrl: p.image_front_small_url ?? '',
    uniqueScans: p.unique_scans_n ?? 0,
    lastModified: p.last_modified_t ?? 0,
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export async function lookupBarcode(raw: string, userId: string, deps: LookupDeps): Promise<LookupResult> {
  const code = normalizeGtin(raw);
  if (!code) return { status: 'invalid' };

  const known = await deps.findByBarcode(code);
  if (known) return { status: 'found', beerId: known };

  if (!(await deps.registerLookup(userId))) return { status: 'rate_limited' };

  let body: { status?: number; product?: OffProduct };
  try {
    const res = await withTimeout(deps.fetchOff(code), deps.timeoutMs ?? OFF_TIMEOUT_MS);
    if (res.status >= 500) return { status: 'unavailable' };
    body = await res.json();
  } catch {
    return { status: 'unavailable' };
  }

  if (body.status !== 1 || !body.product) return { status: 'not_found' };
  const row = toRow(code, body.product);
  if (!isBeer(row.categoriesTags)) return { status: 'not_beer' };

  // No country filter here: whoever scans it is drinking it in our region.
  const [group] = groupRows([row]);
  if (!group) return { status: 'not_found' };
  try {
    return { status: 'imported', beerId: await deps.upsert(group) };
  } catch {
    return { status: 'unavailable' };
  }
}
