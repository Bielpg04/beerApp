import { IN_SCOPE, countryFromOffTag } from './countries.ts';
import type { OffRow } from './types.ts';

/** ABV from OFF ("4,5", 5, "3.635…"), rounded to 2 decimals; null outside 0–70. */
export function parseAbv(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const value = Math.round(Number(text) * 100) / 100;
  return value >= 0 && value <= 70 ? value : null;
}

export function isBeer(categoriesTags: string[]): boolean {
  return categoriesTags.includes('en:beers');
}

export function isInScope(countriesTags: string[]): boolean {
  return countriesTags.some((tag) => IN_SCOPE.has(countryFromOffTag(tag) ?? ''));
}

export function acceptRow(row: OffRow): boolean {
  return (
    isBeer(row.categoriesTags) &&
    isInScope(row.countriesTags) &&
    (row.productName.trim() !== '' || row.brands.trim() !== '')
  );
}
