import { findCountry } from '@/features/profile';
import type { Language } from '@/shared/i18n';

/** "9,5 %" in Catalan/Spanish, "9.5 %" in English. */
export function formatAbv(abv: number, language: string): string {
  const number = new Intl.NumberFormat(language, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(abv);
  return `${number} %`;
}

/** Flag emoji from an ISO 3166-1 alpha-2 code. */
export function flag(code: string): string {
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}

/** "🇧🇪 Bèlgica"; countries outside the app's list show their code ("🇯🇵 JP"). */
export function countryLabel(code: string, language: Language): string {
  return `${flag(code)} ${findCountry(code)?.name[language] ?? code}`;
}
