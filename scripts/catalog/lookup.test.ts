import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createFetchOff,
  lookupBarcode,
  type LookupDeps,
} from '../../supabase/functions/_shared/catalog/lookup.ts';
import type { BeerGroup } from '../../supabase/functions/_shared/catalog/index.ts';

const BEER = {
  status: 1,
  product: {
    code: '8712000900045',
    product_name: 'Heineken Beer',
    brands: 'Heineken',
    categories_tags: ['en:beverages', 'en:beers'],
    countries_tags: ['en:japan'],
    origins_tags: ['en:netherlands'],
    nutriments: { alcohol_100g: 5 },
    image_front_url: 'https://img/front.jpg',
    image_front_small_url: 'https://img/front-small.jpg',
    unique_scans_n: 4,
    last_modified_t: 1700000000,
  },
};

function deps(overrides: Partial<LookupDeps> = {}) {
  const calls = {
    findByBarcode: [] as string[],
    registerLookup: [] as string[],
    fetchOff: [] as string[],
    upsert: [] as BeerGroup[],
  };
  const d: LookupDeps = {
    findByBarcode: async (code) => (calls.findByBarcode.push(code), null),
    registerLookup: async (uid) => (calls.registerLookup.push(uid), true),
    fetchOff: async (code) => (calls.fetchOff.push(code), Response.json(BEER)),
    upsert: async (g) => (calls.upsert.push(g), 'new-beer-id'),
    ...overrides,
  };
  return { d, calls };
}

test('an invalid barcode is rejected without any call', async () => {
  const { d, calls } = deps();
  assert.deepEqual(await lookupBarcode('abc', 'u1', d), { status: 'invalid' });
  assert.equal(calls.findByBarcode.length + calls.fetchOff.length, 0);
});

test('a barcode already in the catalog is found without asking OFF or counting a lookup', async () => {
  const { d, calls } = deps({ findByBarcode: async () => 'known-id' });
  assert.deepEqual(await lookupBarcode('012345678905', 'u1', d), { status: 'found', beerId: 'known-id' });
  assert.equal(calls.registerLookup.length, 0);
  assert.equal(calls.fetchOff.length, 0);
});

test('over the hourly limit nothing is fetched', async () => {
  const { d, calls } = deps({ registerLookup: async () => false });
  assert.deepEqual(await lookupBarcode('8712000900045', 'u1', d), { status: 'rate_limited' });
  assert.equal(calls.fetchOff.length, 0);
});

test('a beer found on OFF is imported, whatever country it is sold in', async () => {
  const { d, calls } = deps();
  assert.deepEqual(await lookupBarcode('8712000900045', 'u1', d), {
    status: 'imported',
    beerId: 'new-beer-id',
  });
  assert.equal(calls.registerLookup[0], 'u1');
  assert.equal(calls.fetchOff[0], '8712000900045');
  const [g] = calls.upsert;
  assert.equal(g.name, 'Heineken Beer');
  assert.equal(g.brandKey, 'heineken');
  assert.equal(g.abv, 5);
  assert.equal(g.country, 'NL');
  assert.equal(g.imageUrl, 'https://img/front.jpg');
  assert.deepEqual(g.barcodes, [{ code: '8712000900045', offLastModified: '2023-11-14T22:13:20.000Z' }]);
});

test('HTML entities in OFF names and brands are decoded before keying', async () => {
  const { d, calls } = deps({
    fetchOff: async () =>
      Response.json({
        ...BEER,
        product: { ...BEER.product, product_name: 'Cerveza &quot;Judas&quot;', brands: 'Smith &amp; Sons' },
      }),
  });
  await lookupBarcode('8712000900045', 'u1', d);
  const [g] = calls.upsert;
  assert.equal(g.name, 'Cerveza "Judas"');
  assert.equal(g.brand, 'Smith & Sons');
  assert.equal(g.brandKey, 'smith sons');
});

test('impossible OFF values are imported as empty', async () => {
  const { d, calls } = deps({
    fetchOff: async () =>
      Response.json({ ...BEER, product: { ...BEER.product, nutriments: {}, alcohol_value: '500' } }),
  });
  await lookupBarcode('8712000900045', 'u1', d);
  assert.equal(calls.upsert[0].abv, null);
});

test('OFF products that are not beers are refused', async () => {
  const { d, calls } = deps({
    fetchOff: async () =>
      Response.json({ status: 1, product: { ...BEER.product, categories_tags: ['en:sodas'] } }),
  });
  assert.deepEqual(await lookupBarcode('8712000900045', 'u1', d), { status: 'not_beer' });
  assert.equal(calls.upsert.length, 0);
});

test('unknown products are not found', async () => {
  const { d } = deps({ fetchOff: async () => Response.json({ status: 0 }, { status: 404 }) });
  assert.deepEqual(await lookupBarcode('8712000900045', 'u1', d), { status: 'not_found' });
});

test('OFF errors and timeouts make the lookup unavailable', async () => {
  const failing = deps({ fetchOff: async () => Promise.reject(new Error('network')) });
  assert.deepEqual(await lookupBarcode('8712000900045', 'u1', failing.d), { status: 'unavailable' });

  const down = deps({ fetchOff: async () => new Response('busy', { status: 503 }) });
  assert.deepEqual(await lookupBarcode('8712000900045', 'u1', down.d), { status: 'unavailable' });

  const slow = deps({ fetchOff: () => new Promise<Response>(() => {}), timeoutMs: 20 });
  assert.deepEqual(await lookupBarcode('8712000900045', 'u1', slow.d), { status: 'unavailable' });
});

test('a 404 from OFF is not found, even without a JSON body', async () => {
  const { d } = deps({ fetchOff: async () => new Response('<html>Not found</html>', { status: 404 }) });
  assert.deepEqual(await lookupBarcode('8712000900045', 'u1', d), { status: 'not_found' });
});

test('other OFF client errors, like rate limiting, make the lookup unavailable', async () => {
  const limited = deps({ fetchOff: async () => Response.json({ status: 0 }, { status: 429 }) });
  assert.deepEqual(await lookupBarcode('8712000900045', 'u1', limited.d), { status: 'unavailable' });

  const forbidden = deps({ fetchOff: async () => new Response('denied', { status: 403 }) });
  assert.deepEqual(await lookupBarcode('8712000900045', 'u1', forbidden.d), { status: 'unavailable' });
});

// The time limit makes a hang fail instead of blocking the run.
test('the timeout aborts the OFF request and also covers reading the body', { timeout: 2000 }, async () => {
  let signal: AbortSignal | undefined;
  const stalled = deps({
    // Headers arrive at once, the body never does.
    fetchOff: async (_code, s) => ((signal = s), new Response(new ReadableStream({ start() {} }))),
    timeoutMs: 20,
  });
  const started = Date.now();
  assert.deepEqual(await lookupBarcode('8712000900045', 'u1', stalled.d), { status: 'unavailable' });
  assert.ok(Date.now() - started < 1000, 'gives up after the timeout');
  assert.equal(signal?.aborted, true, 'and aborts the request');
});

test('fetchOff passes the abort signal to fetch', async () => {
  const seen: (AbortSignal | null | undefined)[] = [];
  const fetchOff = createFetchOff(
    async (_url, init) => (seen.push(init?.signal), Response.json({ status: 0 })),
  );
  const controller = new AbortController();
  await fetchOff('8712000900045', controller.signal);
  assert.equal(seen[0], controller.signal);
});

test("fetchOff asks the product API with BeerApp's User-Agent", async () => {
  const seen: { url: string; init?: RequestInit }[] = [];
  const fetchOff = createFetchOff(
    async (url, init) => (seen.push({ url: String(url), init }), Response.json({ status: 0 })),
  );
  await fetchOff('8712000900045');
  assert.match(
    seen[0].url,
    /^https:\/\/world\.openfoodfacts\.org\/api\/v2\/product\/8712000900045\.json\?fields=/,
  );
  assert.equal(
    new Headers(seen[0].init?.headers).get('User-Agent'),
    'BeerApp/1.0 (https://github.com/Bielpg04/beerApp)',
  );
});

test('a failure while saving the beer makes the lookup unavailable', async () => {
  const { d } = deps({ upsert: async () => Promise.reject(new Error('db down')) });
  assert.deepEqual(await lookupBarcode('8712000900045', 'u1', d), { status: 'unavailable' });
});
