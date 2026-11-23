export type Beer = {
  id: string;
  name: string;
  brand: string;
  abv: number | null;
  country: string | null;
  imageUrl: string | null;
  styleCode: string | null;
  brewery: { name: string; city: string | null } | null;
};

/** Same shape as supabase/functions/_shared/catalog/types.ts (the beer-lookup response). */
export type LookupResult =
  | { status: 'found' | 'imported'; beerId: string }
  | { status: 'not_found' | 'not_beer' | 'unavailable' | 'rate_limited' | 'invalid' };

/** What a beer picker shows. */
export type BeerSummary = {
  id: string;
  name: string;
  brand: string;
  imageThumbUrl: string | null;
  abv: number | null;
  styleCode: string | null;
};
