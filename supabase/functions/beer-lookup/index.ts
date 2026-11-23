// beer-lookup (US-204): finds a beer by barcode, importing it from Open Food Facts if needed.
// POST { barcode } with the user's JWT → LookupResult (always HTTP 200 for a handled outcome).
import { createClient } from '@supabase/supabase-js';

import { createFetchOff, lookupBarcode } from '../_shared/catalog/lookup.ts';
import type { BeerGroup } from '../_shared/catalog/types.ts';

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

const env = (...names: string[]) => names.map((n) => Deno.env.get(n)).find(Boolean) ?? '';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const url = env('SUPABASE_URL');
  const authorization = req.headers.get('Authorization') ?? '';
  // Calls as the user (beer_by_barcode is for signed-in users) …
  const asUser = createClient(url, env('SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY'), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  // … and as the service role for the writes only it may do.
  const asService = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY'), {
    auth: { persistSession: false },
  });

  const { data: auth } = await asUser.auth.getUser(authorization.replace(/^Bearer\s+/i, ''));
  if (!auth.user) return json({ error: 'unauthorized' }, 401);

  let barcode: unknown;
  try {
    ({ barcode } = await req.json());
  } catch {
    return json({ status: 'invalid' });
  }
  if (typeof barcode !== 'string') return json({ status: 'invalid' });

  try {
    return json(
      await lookupBarcode(barcode, auth.user.id, {
        async findByBarcode(code) {
          const { data, error } = await asUser.rpc('beer_by_barcode', { code });
          if (error) throw error;
          return data;
        },
        async registerLookup(uid) {
          const { data, error } = await asService.rpc('catalog_register_lookup', { uid });
          if (error) throw error;
          return data === true;
        },
        fetchOff: createFetchOff(),
        async upsert(g: BeerGroup) {
          const { data, error } = await asService.rpc('catalog_upsert_beer', { g });
          if (error) throw error;
          return data as string;
        },
      }),
    );
  } catch (error) {
    console.error('beer-lookup failed', error);
    return json({ status: 'unavailable' });
  }
});
