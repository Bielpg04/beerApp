/** One product row from the Open Food Facts CSV dump or product API. */
export type OffRow = {
  code: string;
  productName: string;
  brands: string;
  categoriesTags: string[];
  countriesTags: string[];
  originsTags: string[];
  alcohol100g: string;
  imageUrl: string;
  imageSmallUrl: string;
  uniqueScans: number;
  lastModified: number; // epoch seconds
};

/** One beer, ready for catalog_import.upsert_beer (keys are read as-is by SQL). */
export type BeerGroup = {
  name: string;
  nameKey: string;
  brand: string;
  brandKey: string;
  abv: number | null;
  styleCode: string | null;
  country: string | null;
  imageUrl: string | null;
  imageThumbUrl: string | null;
  barcodes: { code: string; offLastModified: string | null }[];
};

export type LookupResult =
  | { status: 'found' | 'imported'; beerId: string }
  | { status: 'not_found' | 'not_beer' | 'unavailable' | 'rate_limited' | 'invalid' };
