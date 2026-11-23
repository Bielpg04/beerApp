// beer-lookup (US-204): finds a beer by barcode, importing it from Open Food Facts if needed.
// POST { barcode } with the user's JWT → LookupResult (always HTTP 200 for a handled outcome).
// The request logic lives in handler.ts; this file only connects it to Supabase.
import { createClient } from '@supabase/supabase-js';

import { createBeerLookupHandler } from './handler.ts';

const env = (...names: string[]) => names.map((n) => Deno.env.get(n)).find(Boolean) ?? '';

Deno.serve(
  createBeerLookupHandler((authorization) => {
    const url = env('SUPABASE_URL');
    // Calls as the user (beer_by_barcode is for signed-in users) …
    const asUser = createClient(url, env('SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY'), {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    // … and as the service role for the writes only it may do.
    const asService = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY'), {
      auth: { persistSession: false },
    });
    return {
      asUser,
      asService,
      async userId() {
        const { data } = await asUser.auth.getUser(authorization.replace(/^Bearer\s+/i, ''));
        return data.user?.id ?? null;
      },
    };
  }),
);
