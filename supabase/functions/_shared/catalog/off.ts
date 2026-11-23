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

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
  nbsp: ' ',
  deg: '°',
};

/** OFF stores some names HTML-escaped ("Cerveza &quot;Judas&quot;"): decode them once, as a browser would. */
export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#\d+|#x[\da-f]+|[a-z]+);/gi, (entity, body: string) => {
    if (body[0] !== '#') return NAMED_ENTITIES[body.toLowerCase()] ?? entity;
    const code =
      body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
    const valid = code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff);
    return valid ? String.fromCodePoint(code) : entity;
  });
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
