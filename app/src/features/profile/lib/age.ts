/** Mirror of public.legal_drinking_age on the server; only for immediate feedback. */
const MIN_AGE_BY_COUNTRY: Record<string, number> = { US: 21 };

export function minDrinkingAge(country: string): number {
  return MIN_AGE_BY_COUNTRY[country.toUpperCase()] ?? 18;
}

/** Same rule as the server: birthdate <= today minus N years (29 Feb → 28 Feb). */
export function isOldEnough(birthdate: Date, country: string, today: Date = new Date()): boolean {
  const years = minDrinkingAge(country);
  const year = today.getUTCFullYear() - years;
  const month = today.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cutoff = Date.UTC(year, month, Math.min(today.getUTCDate(), lastDay));
  return birthdate.getTime() <= cutoff;
}

/** Day, month and year as typed by the user → UTC date, or null if it isn't a real date. */
export function parseBirthdate(day: string, month: string, year: string): Date | null {
  if (!/^\d{1,2}$/.test(day) || !/^\d{1,2}$/.test(month) || !/^\d{4}$/.test(year)) return null;
  const [d, m, y] = [Number(day), Number(month), Number(year)];
  if (y < 1900) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  const valid = date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  return valid ? date : null;
}

export const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);
