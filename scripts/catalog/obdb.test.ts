import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fetchBreweries, toBreweryRow, type ObdbBrewery } from './obdb.ts';

const KRONACH: ObdbBrewery = {
  id: 'ae7b3174-8be8-4d53-a3a5-9b8240970eea',
  name: 'Brauerei Antla',
  city: 'Kronach',
  country: 'Germany',
  longitude: 11.327765,
  latitude: 50.241246,
  website_url: 'http://www.antla.de',
};

test('toBreweryRow maps an Open Brewery DB brewery in scope', () => {
  assert.deepEqual(toBreweryRow(KRONACH), {
    obdb_id: 'ae7b3174-8be8-4d53-a3a5-9b8240970eea',
    name: 'Brauerei Antla',
    name_key: 'antla',
    country: 'DE',
    city: 'Kronach',
    website: 'http://www.antla.de',
    longitude: 11.327765,
    latitude: 50.241246,
  });
});

test('toBreweryRow keeps only Europe and the United States', () => {
  assert.equal(toBreweryRow({ ...KRONACH, country: 'Japan' }), null);
  assert.equal(toBreweryRow({ ...KRONACH, country: 'England' })?.country, 'GB');
  assert.equal(toBreweryRow({ ...KRONACH, country: 'Scotland' })?.country, 'GB');
  assert.equal(toBreweryRow({ ...KRONACH, country: 'United States' })?.country, 'US');
});

test('toBreweryRow drops missing coordinates and empty names', () => {
  const row = toBreweryRow({ ...KRONACH, longitude: null, latitude: null, website_url: null });
  assert.equal(row?.longitude, null);
  assert.equal(row?.latitude, null);
  assert.equal(row?.website, null);
  assert.equal(toBreweryRow({ ...KRONACH, name: '  ' }), null);
});

test('fetchBreweries reads pages of 200 until an empty page', async () => {
  const urls: string[] = [];
  const pages = [[KRONACH, { ...KRONACH, id: 'b' }], [{ ...KRONACH, id: 'c' }], []];
  const fakeFetch = async (url: string | URL | Request) => {
    urls.push(String(url));
    return new Response(JSON.stringify(pages[urls.length - 1]));
  };
  const all: ObdbBrewery[] = [];
  for await (const b of fetchBreweries(fakeFetch)) all.push(b);
  assert.deepEqual(
    all.map((b) => b.id),
    ['ae7b3174-8be8-4d53-a3a5-9b8240970eea', 'b', 'c'],
  );
  assert.equal(urls.length, 3);
  assert.match(urls[0], /per_page=200&page=1$/);
  assert.match(urls[2], /page=3$/);
});

test('fetchBreweries fails loudly on an HTTP error', async () => {
  const fakeFetch = async () => new Response('nope', { status: 503 });
  await assert.rejects(async () => {
    for await (const _ of fetchBreweries(fakeFetch)) void _;
  }, /503/);
});
