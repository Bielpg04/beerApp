import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { supabase } from '@/shared/lib/supabase';

import type { BeerSummary } from '../types';

const MAX_RESULTS = 20;

/** Beers whose brand + name contain every word of the query (≥ 2 characters). */
export function useBeerSearch(query: string) {
  const q = query.trim().replace(/\s+/g, ' ');
  return useQuery({
    queryKey: ['beers', 'search', q],
    enabled: q.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<BeerSummary[]> => {
      const { data, error } = await supabase.rpc('search_beers', { q, max_results: MAX_RESULTS });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        brand: row.brand,
        imageThumbUrl: row.image_thumb_url,
        abv: row.abv,
        styleCode: row.style_code,
      }));
    },
  });
}

/** One beer as a picker shows it (following merges), or null if it does not exist. */
export async function fetchBeerSummary(id: string): Promise<BeerSummary | null> {
  const { data: finalId, error: rpcError } = await supabase.rpc('resolve_beer', { beer: id });
  if (rpcError) throw rpcError;
  if (!finalId) return null;
  const { data, error } = await supabase
    .from('beers')
    .select('id, name, brand, image_thumb_url, abv, style_code')
    .eq('id', finalId)
    .maybeSingle();
  if (error) throw error;
  return data
    ? {
        id: data.id,
        name: data.name,
        brand: data.brand,
        imageThumbUrl: data.image_thumb_url,
        abv: data.abv,
        styleCode: data.style_code,
      }
    : null;
}
