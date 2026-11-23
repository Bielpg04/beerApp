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
