import { countryFromOffTag } from './countries.ts';
import { normalizeGtin } from './gtin.ts';
import { beerNameKey, brandKey, displayName, isGenericOnly } from './keys.ts';
import { parseAbv } from './off.ts';
import { styleFromName, styleFromTags } from './styles.ts';
import type { BeerGroup, OffRow } from './types.ts';

type Prepared = { row: OffRow; code: string; name: string; brand: string };

function firstBrand(brands: string): string {
  return (
    brands
      .split(',')
      .map((b) => b.trim())
      .find(Boolean) ?? ''
  );
}

function prepare(row: OffRow): Prepared | null {
  const code = normalizeGtin(row.code);
  if (!code) return null;
  const name = row.productName.trim() || firstBrand(row.brands);
  const brand = firstBrand(row.brands) || name;
  if (!name || (isGenericOnly(name) && isGenericOnly(brand))) return null;
  // A brand with no letters or digits ("★") would share the empty key with every other such brand.
  if (brandKey(brand) === '') return null;
  return { row, code, name, brand };
}

/** The value of the most-scanned row that has one. */
function fromMostScanned<T>(rows: OffRow[], pick: (r: OffRow) => T | null): T | null {
  const sorted = [...rows].sort((a, b) => b.uniqueScans - a.uniqueScans);
  for (const r of sorted) {
    const value = pick(r);
    if (value !== null) return value;
  }
  return null;
}

function mode(values: number[]): number | null {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: number | null = null;
  let bestCount = 0;
  for (const [v, c] of counts) {
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

function toGroup(items: Prepared[]): BeerGroup {
  const rows = items.map((i) => i.row);
  // The database accepts at most 200 characters.
  const brand = displayName(items.map((i) => i.brand))
    .slice(0, 200)
    .trim();
  const name = displayName(items.map((i) => i.name))
    .slice(0, 200)
    .trim();
  const imageRow = fromMostScanned(rows, (r) => (r.imageUrl ? r : null));

  const lastModified = new Map<string, number>();
  for (const i of items)
    lastModified.set(i.code, Math.max(lastModified.get(i.code) ?? 0, i.row.lastModified || 0));

  return {
    name,
    nameKey: beerNameKey(name, brand),
    brand,
    brandKey: brandKey(brand),
    abv: mode(rows.map((r) => parseAbv(r.alcohol100g)).filter((v): v is number => v !== null)),
    styleCode: fromMostScanned(rows, (r) => styleFromTags(r.categoriesTags)) ?? styleFromName(name),
    country: fromMostScanned(rows, (r) => r.originsTags.map(countryFromOffTag).find(Boolean) ?? null),
    imageUrl: imageRow?.imageUrl || null,
    imageThumbUrl: imageRow?.imageSmallUrl || null,
    barcodes: [...lastModified].map(([code, t]) => ({
      code,
      offLastModified: t > 0 ? new Date(t * 1000).toISOString() : null,
    })),
  };
}

/** Groups OFF rows into beers: rows with the same (brandKey, beerNameKey) are one beer. */
export function groupRows(rows: OffRow[]): BeerGroup[] {
  const groups = new Map<string, Prepared[]>();
  for (const row of rows) {
    const p = prepare(row);
    if (!p) continue;
    const key = `${brandKey(p.brand)}|${beerNameKey(p.name, p.brand)}`;
    const list = groups.get(key);
    if (list) list.push(p);
    else groups.set(key, [p]);
  }
  return [...groups.values()].map(toGroup);
}
