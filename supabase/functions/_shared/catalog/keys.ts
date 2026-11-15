/**
 * Dedup keys. Two OFF products are the same beer when they share
 * (brandKey, beerNameKey): same words once accents, punctuation, the brand,
 * generic words ("beer", "cerveza"…) and pack sizes ("6x33cl", "lata") are removed.
 */

// "Beer" in the languages OFF products are named in, plus words that are noise in a name.
const GENERIC = new Set([
  'beer',
  'beers',
  'biere',
  'bieres',
  'bier',
  'biers',
  'cerveza',
  'cervezas',
  'cervesa',
  'cerveses',
  'cerveja',
  'cervejas',
  'birra',
  'birre',
  'piwo',
  'pivo',
  'olut',
  'sor',
  'bira',
  'can',
  'cans',
  'bottle',
  'bottles',
  'lata',
  'latas',
  'llauna',
  'llaunes',
  'botella',
  'botellas',
  'botellin',
  'ampolla',
  'ampolles',
  'bouteille',
  'canette',
  'flasche',
  'dose',
  'blik',
  'fles',
  'pack',
  'packs',
  'pk',
  'x',
  'e',
  'vol',
  'alc',
  'abv',
  'cl',
  'ml',
  'l',
  'oz',
  'fl',
  'pt',
]);

// Style words: a name made only of these (after removing the brand) is just the brand's beer.
const STYLE_ONLY = new Set(['lager', 'lagers', 'pils', 'pilsner', 'pilsener', 'helles']);

const BREWERY_WORDS = new Set([
  'brewery',
  'breweries',
  'brewing',
  'brewers',
  'brewer',
  'brewhouse',
  'brewpub',
  'co',
  'company',
  'inc',
  'llc',
  'ltd',
  'limited',
  'gmbh',
  'sa',
  'sl',
  'bv',
  'nv',
  'ag',
  'kg',
  'the',
  'and',
  'brauerei',
  'brau',
  'brasserie',
  'brouwerij',
  'bierbrouwerij',
  'cervecera',
  'cerveceria',
  'cervejaria',
  'birrificio',
  'browar',
  'pivovar',
  'bryggeri',
]);

const VOLUME_PATTERNS = [
  /\d+(?:[.,]\d+)?\s*(?:degres?|°)(?:\s*(?:d\s*)?(?:alcool|alc|vol))?/g, // 5.0 DEGRE ALCOOL, 6°
  /\d+\s*x\s*\d+(?:[.,]\d+)?\s*(?:cl|ml|l|oz|fl\s*oz)\b/g, // 6x33cl, 4 x 500 ml
  /\d+(?:[.,]\d+)?\s*(?:cl|ml|l|oz|fl\s*oz|pt)\b/g, // 33cl, 500 ml, 0,5l, 12 fl oz
  /\d+(?:[.,]\d+)?\s*%(?:\s*vol)?/g, // 5%, 4,5 % vol
  /\b\d+\s*x\b/g, // 6x
];

function words(text: string): string[] {
  let t = (text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/['’`]/g, '');
  for (const re of VOLUME_PATTERNS) t = t.replace(re, ' ');
  return t.split(/[^a-z0-9]+/).filter(Boolean);
}

/** True when the text has no word besides generic ones ("Bière", "Cerveza 33cl"). */
export function isGenericOnly(text: string): boolean {
  return words(text).every((w) => GENERIC.has(w));
}

export function brandKey(brand: string): string {
  const all = words(brand);
  const kept = all.filter((w) => !GENERIC.has(w) && !BREWERY_WORDS.has(w));
  return (kept.length > 0 ? kept : all).join(' ');
}

export function beerNameKey(name: string, brand: string): string {
  const brandWords = new Set(brandKey(brand).split(' '));
  const kept = words(name).filter((w) => !brandWords.has(w) && !GENERIC.has(w));
  if (kept.length === 0 || kept.every((w) => STYLE_ONLY.has(w))) return brandKey(brand);
  return kept.join(' ');
}

function titleCase(text: string): string {
  return text
    .toLowerCase()
    .replace(/(^|[\s\-'(])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

// Same noise as VOLUME_PATTERNS, matched on the original text (any case, with accents).
const DISPLAY_NOISE = [
  /\d+(?:[.,]\d+)?\s*(?:degr[ée]s?|°)(?:\s*(?:d['’]?\s*)?(?:alcool|alc\.?|vol\.?))?/giu,
  /\d+\s*x\s*\d+(?:[.,]\d+)?\s*(?:cl|ml|l|oz|fl\.?\s*oz)\b\.?/giu,
  /\b\d+(?:[.,]\d+)?\s*(?:cl|ml|l|oz|fl\.?\s*oz)\b\.?/giu,
  /\d+(?:[.,]\d+)?\s*%(?:\s*vol\.?)?/giu,
];

/** Drops pack sizes and ABV labels and repeated words: "1664 6x25cl 1664 Millesime 6.7 Degre Alcool" → "1664 Millesime". */
function cleanName(name: string): string {
  let text = name;
  for (const re of DISPLAY_NOISE) text = text.replace(re, ' ');
  const out: string[] = [];
  const seen = new Set<string>();
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(word);
  }
  return out.join(' ').replace(/^[\s\-–,.]+|[\s\-–,]+$/g, '') || name.trim();
}

/** The most frequent (cleaned) spelling, first one on ties, title-cased if it came all in one case. */
export function displayName(names: string[]): string {
  const counts = new Map<string, number>();
  for (const n of names.map(cleanName).filter(Boolean)) counts.set(n, (counts.get(n) ?? 0) + 1);
  let best = '';
  let bestCount = 0;
  for (const [n, c] of counts) {
    if (c > bestCount) {
      best = n;
      bestCount = c;
    }
  }
  const hasLetters = /\p{L}/u.test(best);
  if (hasLetters && (best === best.toLowerCase() || best === best.toUpperCase())) return titleCase(best);
  return best;
}
