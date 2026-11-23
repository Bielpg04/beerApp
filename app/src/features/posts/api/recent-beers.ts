import { useQuery } from '@tanstack/react-query';

import type { BeerSummary } from '@/features/beers';
import { supabase } from '@/shared/lib/supabase';

const SHOWN = 5;

type Row = {
  beer: {
    id: string;
    name: string;
    brand: string;
    image_thumb_url: string | null;
    abv: number | null;
    style_code: string | null;
  };
};

/** The last different beers the user logged, newest first. */
export function useRecentBeers(userId: string) {
  return useQuery({
    queryKey: ['posts', 'mine', 'recent-beers'],
    queryFn: async (): Promise<BeerSummary[]> => {
      const { data, error } = await supabase
        .from('posts')
        .select('beer:beers(id, name, brand, image_thumb_url, abv, style_code)')
        .eq('author_id', userId)
        .order('consumed_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      const seen = new Set<string>();
      const beers: BeerSummary[] = [];
      for (const { beer } of (data ?? []) as Row[]) {
        if (seen.has(beer.id)) continue;
        seen.add(beer.id);
        beers.push({
          id: beer.id,
          name: beer.name,
          brand: beer.brand,
          imageThumbUrl: beer.image_thumb_url,
          abv: beer.abv,
          styleCode: beer.style_code,
        });
        if (beers.length === SHOWN) break;
      }
      return beers;
    },
  });
}
