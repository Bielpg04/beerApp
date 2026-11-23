import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createBeerLookupHandler, type RpcClient } from '../../supabase/functions/beer-lookup/handler.ts';

type Rpc = { fn: string; args: Record<string, unknown> };
type Answers = Record<string, { data: unknown; error: unknown }>;

function client(answers: Answers, calls: Rpc[]): RpcClient {
  return {
    rpc: async (fn, args) => {
      calls.push({ fn, args });
      return answers[fn] ?? { data: null, error: { message: `unexpected rpc ${fn}` } };
    },
  };
}

function setup({ userId = 'u1' as string | null, asUser = {} as Answers, asService = {} as Answers } = {}) {
  const calls = { auth: [] as string[], asUser: [] as Rpc[], asService: [] as Rpc[], off: [] as string[] };
  const handler = createBeerLookupHandler(
    (authorization) => ({
      userId: async () => (calls.auth.push(authorization), userId),
      asUser: client(asUser, calls.asUser),
      asService: client(asService, calls.asService),
    }),
    async (code) => (calls.off.push(code), Response.json({ status: 0 }, { status: 404 })),
  );
  return { handler, calls };
}

const post = (body: unknown, authorization = 'Bearer token') =>
  new Request('http://localhost/functions/v1/beer-lookup', {
    method: 'POST',
    headers: { Authorization: authorization, 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

test('the handler answers CORS preflights and refuses other methods', async () => {
  const { handler } = setup();
  const preflight = await handler(new Request('http://localhost/', { method: 'OPTIONS' }));
  assert.equal(preflight.status, 200);
  assert.match(preflight.headers.get('Access-Control-Allow-Headers') ?? '', /authorization/);
  assert.equal((await handler(new Request('http://localhost/', { method: 'GET' }))).status, 405);
});

test('a request without a signed-in user gets 401 and touches nothing', async () => {
  const { handler, calls } = setup({ userId: null });
  const res = await handler(post({ barcode: '8712000900045' }, 'Bearer bad'));
  assert.equal(res.status, 401);
  assert.deepEqual(await res.json(), { error: 'unauthorized' });
  assert.deepEqual(calls.auth, ['Bearer bad']);
  assert.equal(calls.asUser.length + calls.asService.length + calls.off.length, 0);
});

test('a body without a barcode string is invalid', async () => {
  const { handler } = setup();
  assert.deepEqual(await (await handler(post('not json'))).json(), { status: 'invalid' });
  assert.deepEqual(await (await handler(post({ barcode: 42 }))).json(), { status: 'invalid' });
});

test('a known barcode is looked up as the user', async () => {
  const { handler, calls } = setup({ asUser: { beer_by_barcode: { data: 'beer-1', error: null } } });
  const res = await handler(post({ barcode: '8712000900045' }));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'found', beerId: 'beer-1' });
  assert.deepEqual(calls.asUser, [{ fn: 'beer_by_barcode', args: { code: '8712000900045' } }]);
  assert.equal(calls.asService.length, 0);
});

test('an unknown barcode is counted with the service role before asking OFF', async () => {
  const { handler, calls } = setup({
    asUser: { beer_by_barcode: { data: null, error: null } },
    asService: { catalog_register_lookup: { data: true, error: null } },
  });
  assert.deepEqual(await (await handler(post({ barcode: '8712000900045' }))).json(), { status: 'not_found' });
  assert.deepEqual(calls.asService, [{ fn: 'catalog_register_lookup', args: { uid: 'u1' } }]);
  assert.deepEqual(calls.off, ['8712000900045']);
});

test('database errors make the lookup unavailable', async () => {
  const failingRead = setup({ asUser: { beer_by_barcode: { data: null, error: { message: 'down' } } } });
  const read = await failingRead.handler(post({ barcode: '8712000900045' }));
  assert.equal(read.status, 200);
  assert.deepEqual(await read.json(), { status: 'unavailable' });

  const failingCount = setup({
    asUser: { beer_by_barcode: { data: null, error: null } },
    asService: { catalog_register_lookup: { data: null, error: { message: 'down' } } },
  });
  assert.deepEqual(await (await failingCount.handler(post({ barcode: '8712000900045' }))).json(), {
    status: 'unavailable',
  });
  assert.equal(failingCount.calls.off.length, 0);
});
