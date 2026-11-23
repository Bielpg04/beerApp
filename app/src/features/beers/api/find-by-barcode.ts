import { supabase } from '@/shared/lib/supabase';

import { expandUpcE } from '../lib/upc-e';
import type { LookupResult } from '../types';

/**
 * Catalog first (cheap RPC); only unknown barcodes go to the beer-lookup Edge Function,
 * which may import the beer from Open Food Facts. Network problems → 'unavailable'.
 */
export async function findBeerByBarcode(code: string, type: string): Promise<LookupResult> {
  const barcode = type === 'upc_e' ? expandUpcE(code) : code;
  try {
    const { data: beerId, error } = await supabase.rpc('beer_by_barcode', { code: barcode });
    if (error) return { status: 'unavailable' };
    if (beerId) return { status: 'found', beerId };

    const { data, error: fnError } = await supabase.functions.invoke<LookupResult>('beer-lookup', {
      body: { barcode },
    });
    if (fnError || !data) return { status: 'unavailable' };
    return data;
  } catch {
    return { status: 'unavailable' };
  }
}
