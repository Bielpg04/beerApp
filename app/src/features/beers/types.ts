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
