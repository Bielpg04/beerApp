/**
 * Barcodes are stored as GTIN: EAN-13 (UPC-A gets a leading 0) or EAN-8.
 * Same rules as public.normalize_gtin in the database. Returns null if invalid.
 */
export function normalizeGtin(raw: string): string | null {
  let digits = (raw ?? '').replace(/\D/g, '');
  if (digits.length === 12) digits = `0${digits}`;
  else if (digits.length === 14 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length !== 8 && digits.length !== 13) return null;

  let total = 0;
  for (let i = 1; i < digits.length; i++) {
    total += Number(digits[digits.length - 1 - i]) * (i % 2 === 1 ? 3 : 1);
  }
  return (10 - (total % 10)) % 10 === Number(digits[digits.length - 1]) ? digits : null;
}
