// The beer-lookup request handler, kept free of Deno and npm imports so Node can test it
// (scripts/catalog/beer-lookup-handler.test.ts). index.ts only builds the Supabase clients.
import { createFetchOff, lookupBarcode, type LookupDeps } from '../_shared/catalog/lookup.ts';
import type { BeerGroup } from '../_shared/catalog/types.ts';

/** The part of a Supabase client the handler uses. */
export type RpcClient = {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
};

/** Per request: who is calling, a client acting as them and a service-role client. */
export type Connect = (authorization: string) => {
  userId(): Promise<string | null>;
  asUser: RpcClient;
  asService: RpcClient;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

async function call(client: RpcClient, fn: string, args: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw error;
  return data;
}

export function createBeerLookupHandler(
  connect: Connect,
  fetchOff: LookupDeps['fetchOff'] = createFetchOff(),
): (req: Request) => Promise<Response> {
  return async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

    const { userId, asUser, asService } = connect(req.headers.get('Authorization') ?? '');
    const uid = await userId();
    if (!uid) return json({ error: 'unauthorized' }, 401);

    let barcode: unknown;
    try {
      ({ barcode } = await req.json());
    } catch {
      return json({ status: 'invalid' });
    }
    if (typeof barcode !== 'string') return json({ status: 'invalid' });

    try {
      return json(
        await lookupBarcode(barcode, uid, {
          // beer_by_barcode is for signed-in users: called as the user …
          findByBarcode: async (code) => (await call(asUser, 'beer_by_barcode', { code })) as string | null,
          // … the writes only the service role may do.
          registerLookup: async (id) =>
            (await call(asService, 'catalog_register_lookup', { uid: id })) === true,
          fetchOff,
          upsert: async (g: BeerGroup) => (await call(asService, 'catalog_upsert_beer', { g })) as string,
        }),
      );
    } catch (error) {
      console.error('beer-lookup failed', error);
      return json({ status: 'unavailable' });
    }
  };
}
