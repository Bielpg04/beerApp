import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  acceptRow,
  beerNameKey,
  brandKey,
  countryFromName,
  countryFromOffTag,
  displayName,
  groupRows,
  isBeer,
  isInScope,
  normalizeGtin,
  parseAbv,
  styleFromName,
  styleFromTags,
} from '../../supabase/functions/_shared/catalog/index.ts';
import type { OffRow } from '../../supabase/functions/_shared/catalog/index.ts';

function row(overrides: Partial<OffRow>): OffRow {
  return {
    code: '8712000900045',
    productName: 'Heineken Beer',
    brands: 'Heineken',
    categoriesTags: ['en:beverages', 'en:beers'],
    countriesTags: ['en:spain'],
    originsTags: [],
    alcohol100g: '',
    imageUrl: '',
    imageSmallUrl: '',
    uniqueScans: 0,
    lastModified: 1700000000,
    ...overrides,
  };
}

test('normalizeGtin keeps the same rules as the database', () => {
  assert.equal(normalizeGtin('012345678905'), '0012345678905');
  assert.equal(normalizeGtin('00012345678905'), '0012345678905');
  assert.equal(normalizeGtin('96385074'), '96385074');
  assert.equal(normalizeGtin(' 0012-3456-78905 '), '0012345678905');
  assert.equal(normalizeGtin('0012345678906'), null);
  assert.equal(normalizeGtin('abc'), null);
  assert.equal(normalizeGtin('5410228142249'), '5410228142249');
});

test('Heineken variants share one key', () => {
  const key = beerNameKey('Heineken Beer', 'Heineken Bier');
  assert.equal(beerNameKey('Heineken Lager Beer', 'Heineken'), key);
  assert.equal(beerNameKey('HEINEKEN', 'Heineken'), key);
  assert.equal(brandKey('Heineken Bier'), brandKey('Heineken'));
});

test('a name that is only the brand or a generic word falls back to the brand', () => {
  assert.equal(beerNameKey('bud', 'Bud'), 'bud');
  assert.equal(beerNameKey('Beer', 'Coors Light'), 'coors light');
});

test('different beers of the same brand keep different keys', () => {
  assert.notEqual(
    beerNameKey('Cheschire Chocolate Porter 500 ml', 'Marks & Spencer'),
    beerNameKey('London Porter', 'Marks & Spencer'),
  );
});

test('pack sizes and container words are ignored', () => {
  assert.equal(
    beerNameKey('Estrella Damm 6x33cl', 'Estrella Damm'),
    beerNameKey('Estrella Damm lata', 'Estrella Damm'),
  );
});

test('brewery suffixes are ignored in brand keys', () => {
  assert.equal(brandKey('Sierra Nevada'), brandKey('Sierra Nevada Brewing Co.'));
  assert.equal(brandKey('Brasserie Dupont'), brandKey('Dupont'));
});

test('displayName picks the most frequent spelling and fixes all-lowercase names', () => {
  assert.equal(displayName(['bud', 'bud', 'Bud']), 'Bud');
  assert.equal(displayName(['London Porter']), 'London Porter');
});

test('parseAbv accepts commas, rounds, and rejects impossible values', () => {
  assert.equal(parseAbv('4,5'), 4.5);
  assert.equal(parseAbv('500'), null);
  assert.equal(parseAbv(''), null);
  assert.equal(parseAbv('3.6350110741035047'), 3.64);
  assert.equal(parseAbv(5), 5);
  assert.equal(parseAbv(null), null);
});

test('styleFromTags takes the highest-priority style', () => {
  assert.equal(styleFromTags(['en:beers', 'en:lagers', 'en:non-alcoholic-beers']), 'non_alcoholic');
  assert.equal(styleFromTags(['en:beers', 'en:stouts']), 'stout');
  assert.equal(styleFromTags(['en:beers']), null);
});

test('styles are found in the irregular tags OFF really uses', () => {
  assert.equal(styleFromTags(['en:beers', 'ca:cervesa-ipa']), 'ipa');
  assert.equal(styleFromTags(['en:beers', 'fr:Bières Porter']), 'porter');
  assert.equal(styleFromTags(['en:beers', 'en:pale-ales', 'en:session-ipa']), 'ipa');
  assert.equal(styleFromTags(['en:beers', 'en:beers-with-fruits']), 'fruit');
  assert.equal(styleFromTags(['en:beers', 'en:craft-beers', 'en:ales']), null);
});

test('styleFromName is the fallback when OFF has no style', () => {
  assert.equal(styleFromName('Flat White Porter'), 'porter');
  assert.equal(styleFromName('Estrella Damm 0,0'), 'non_alcoholic');
  assert.equal(styleFromName('Hoptimista'), null);
});

test('apostrophes do not split words', () => {
  assert.equal(brandKey("Fuller's"), brandKey('Fullers'));
  assert.equal(brandKey("Alexander Keith's"), 'alexander keiths');
});

test('countries: OFF tags and English names map to ISO codes', () => {
  assert.equal(countryFromOffTag('en:belgium'), 'BE');
  assert.equal(countryFromOffTag('en:united-kingdom'), 'GB');
  assert.equal(countryFromOffTag('en:japan'), 'JP');
  assert.equal(countryFromOffTag('en:atlantis'), null);
  assert.equal(countryFromName('Germany'), 'DE');
  assert.equal(countryFromName('England'), 'GB');
  assert.equal(countryFromName('Scotland'), 'GB');
});

test('scope is Europe and the United States', () => {
  assert.equal(isInScope(['en:japan']), false);
  assert.equal(isInScope(['en:japan', 'en:spain']), true);
  assert.equal(isInScope(['en:united-states']), true);
  assert.equal(isBeer(['en:beverages', 'en:beers']), true);
  assert.equal(isBeer(['en:wines']), false);
});

test('acceptRow needs a beer in scope with a name or a brand', () => {
  assert.equal(acceptRow(row({})), true);
  assert.equal(acceptRow(row({ productName: '', brands: '' })), false);
  assert.equal(acceptRow(row({ countriesTags: ['en:japan'] })), false);
  assert.equal(acceptRow(row({ categoriesTags: ['en:sodas'] })), false);
});

test('groupRows merges barcodes of the same beer', () => {
  const groups = groupRows([
    row({
      code: '8712000900045',
      productName: 'Heineken Beer',
      alcohol100g: '5',
      uniqueScans: 3,
      imageUrl: 'a.jpg',
    }),
    row({
      code: '0072890000224',
      productName: 'Heineken Lager Beer',
      alcohol100g: '5',
      uniqueScans: 9,
      imageUrl: 'b.jpg',
      imageSmallUrl: 'b-small.jpg',
    }),
    row({ code: '8712000900045', productName: 'heineken', alcohol100g: '4', uniqueScans: 1 }),
  ]);
  assert.equal(groups.length, 1);
  const [g] = groups;
  assert.deepEqual(g.barcodes.map((b) => b.code).sort(), ['0072890000224', '8712000900045']);
  assert.equal(g.abv, 5);
  assert.equal(g.imageUrl, 'b.jpg');
  assert.equal(g.imageThumbUrl, 'b-small.jpg');
  assert.equal(g.brand, 'Heineken');
  assert.equal(g.brandKey, 'heineken');
  assert.equal(g.barcodes[0].offLastModified, '2023-11-14T22:13:20.000Z');
});

test('groupRows drops rows whose barcode is invalid and takes the origin country', () => {
  const groups = groupRows([
    row({ code: '123', productName: 'Broken' }),
    row({ code: '5410228142249', productName: 'Tripel', brands: 'Westmalle', originsTags: ['en:belgium'] }),
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].country, 'BE');
  assert.equal(groups[0].name, 'Tripel');
});
