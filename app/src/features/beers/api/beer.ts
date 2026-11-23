import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/shared/lib/supabase';

import type { Beer } from '../types';

export const beerKey = (id: string) => ['beer', id] as const;

/** A beer by id, following merged_into to the final beer; null if it does not exist. */
async function fetchBeer(id: string): Promise<Beer | null> {
  const { data: finalId, error: rpcError } = await supabase.rpc('resolve_beer', { beer: id });
  if (rpcError) throw rpcError;
  if (!finalId) return null;

  const { data, error } = await supabase
    .from('beers')
    .select('id, name, brand, abv, country, image_url, style_code, brewery:breweries(name, city)')
    .eq('id', finalId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    brand: data.brand,
    abv: data.abv,
    country: data.country,
    imageUrl: data.image_url,
    styleCode: data.style_code,
    brewery: data.brewery ? { name: data.brewery.name, city: data.brewery.city } : null,
  };
}

export function useBeer(id: string) {
  return useQuery({ queryKey: beerKey(id), queryFn: () => fetchBeer(id) });
}
