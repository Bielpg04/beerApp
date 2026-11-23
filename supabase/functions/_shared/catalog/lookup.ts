/**
 * Live barcode lookup (US-204): catalog first, then the Open Food Facts product API.
 * Pure logic with injected dependencies, so Node can test what the Edge Function runs.
 */
import { groupRows } from './group.ts';
import { normalizeGtin } from './gtin.ts';
import { decodeHtmlEntities, isBeer } from './off.ts';
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
  /** Should pass `signal` on to fetch, so the timeout cancels the request. */
  fetchOff(code: string, signal?: AbortSignal): Promise<Response>;
  upsert(group: BeerGroup): Promise<string>;
  timeoutMs?: number;
};

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

export function createFetchOff(
  fetchImpl: Fetch = fetch,
): (code: string, signal?: AbortSignal) => Promise<Response> {
  return (code, signal) =>
    fetchImpl(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${FIELDS}`, {
      headers: { 'User-Agent': USER_AGENT },
      signal,
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
    productName: decodeHtmlEntities(p.product_name ?? '').trim(),
    brands: decodeHtmlEntities(p.brands ?? '').trim(),
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

type OffBody = { status?: number; product?: OffProduct };

/**
 * The OFF answer, or null for an unknown product (404). Throws on any other failure.
 * The timeout covers the whole exchange, body included, and aborts the request.
 */
async function readOff(deps: LookupDeps, code: string): Promise<OffBody | null> {
  const controller = new AbortController();
  const timedOut = new Promise<never>((_, reject) => {
    controller.signal.addEventListener('abort', () => reject(new Error('timeout')), { once: true });
  });
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? OFF_TIMEOUT_MS);
  const exchange = async () => {
    const res = await deps.fetchOff(code, controller.signal);
    if (res.status === 404) {
      await res.body?.cancel();
      return null;
    }
    // Rate limiting (429) and other errors say nothing about the product.
    if (!res.ok) throw new Error(`Open Food Facts: HTTP ${res.status}`);
    return (await res.json()) as OffBody;
  };
  try {
    return await Promise.race([exchange(), timedOut]);
  } finally {
    clearTimeout(timer);
  }
}

export async function lookupBarcode(raw: string, userId: string, deps: LookupDeps): Promise<LookupResult> {
  const code = normalizeGtin(raw);
  if (!code) return { status: 'invalid' };

  const known = await deps.findByBarcode(code);
  if (known) return { status: 'found', beerId: known };

  if (!(await deps.registerLookup(userId))) return { status: 'rate_limited' };

  let body: OffBody | null;
  try {
    body = await readOff(deps, code);
  } catch {
    return { status: 'unavailable' };
  }

  if (!body || body.status !== 1 || !body.product) return { status: 'not_found' };
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
