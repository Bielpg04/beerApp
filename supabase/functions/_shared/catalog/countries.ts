/** ISO 3166-1 codes from OFF country tags ("en:belgium") and English names (Open Brewery DB). */

// [ISO, English name, extra OFF tags / names]
const COUNTRIES: [string, string, ...string[]][] = [
  ['AL', 'Albania'],
  ['AD', 'Andorra'],
  ['AT', 'Austria'],
  ['BY', 'Belarus'],
  ['BE', 'Belgium'],
  ['BA', 'Bosnia and Herzegovina'],
  ['BG', 'Bulgaria'],
  ['HR', 'Croatia'],
  ['CY', 'Cyprus'],
  ['CZ', 'Czech Republic', 'Czechia'],
  ['DK', 'Denmark'],
  ['EE', 'Estonia'],
  ['FI', 'Finland'],
  ['FR', 'France'],
  ['DE', 'Germany'],
  ['GR', 'Greece'],
  ['HU', 'Hungary'],
  ['IS', 'Iceland'],
  ['IE', 'Ireland'],
  ['IT', 'Italy'],
  ['LV', 'Latvia'],
  ['LI', 'Liechtenstein'],
  ['LT', 'Lithuania'],
  ['LU', 'Luxembourg'],
  ['MT', 'Malta'],
  ['MD', 'Moldova'],
  ['MC', 'Monaco'],
  ['ME', 'Montenegro'],
  ['NL', 'Netherlands', 'The Netherlands', 'Holland'],
  ['MK', 'North Macedonia', 'Macedonia'],
  ['NO', 'Norway'],
  ['PL', 'Poland'],
  ['PT', 'Portugal'],
  ['RO', 'Romania'],
  ['RU', 'Russia'],
  ['SM', 'San Marino'],
  ['RS', 'Serbia'],
  ['SK', 'Slovakia'],
  ['SI', 'Slovenia'],
  ['ES', 'Spain'],
  ['SE', 'Sweden'],
  ['CH', 'Switzerland'],
  ['UA', 'Ukraine'],
  ['VA', 'Vatican City'],
  ['GB', 'United Kingdom', 'England', 'Scotland', 'Wales', 'Northern Ireland', 'UK', 'Great Britain'],
  ['US', 'United States', 'USA', 'United States of America'],
  // Outside the import scope, but useful as a beer's country of origin.
  ['CA', 'Canada'],
  ['MX', 'Mexico'],
  ['JP', 'Japan'],
  ['CN', 'China'],
  ['KR', 'South Korea'],
  ['TH', 'Thailand'],
  ['IN', 'India'],
  ['SG', 'Singapore'],
  ['AU', 'Australia'],
  ['NZ', 'New Zealand'],
  ['ZA', 'South Africa'],
  ['BR', 'Brazil'],
  ['AR', 'Argentina'],
  ['TR', 'Turkey'],
  ['IL', 'Israel'],
  ['PH', 'Philippines'],
  ['VN', 'Vietnam'],
  ['IM', 'Isle of Man'],
];

/** Europe + United States: the countries whose beers are imported in bulk. */
export const IN_SCOPE = new Set([
  'AL',
  'AD',
  'AT',
  'BY',
  'BE',
  'BA',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IS',
  'IE',
  'IT',
  'LV',
  'LI',
  'LT',
  'LU',
  'MT',
  'MD',
  'MC',
  'ME',
  'NL',
  'MK',
  'NO',
  'PL',
  'PT',
  'RO',
  'RU',
  'SM',
  'RS',
  'SK',
  'SI',
  'ES',
  'SE',
  'CH',
  'UA',
  'VA',
  'GB',
  'US',
]);

const slug = (name: string) => name.toLowerCase().replace(/[^a-z]+/g, '-');

const BY_TAG = new Map<string, string>();
const BY_NAME = new Map<string, string>();
for (const [iso, ...names] of COUNTRIES) {
  for (const name of names) {
    BY_TAG.set(`en:${slug(name)}`, iso);
    BY_NAME.set(name.toLowerCase(), iso);
  }
}

export function countryFromOffTag(tag: string): string | null {
  return BY_TAG.get(tag.trim().toLowerCase()) ?? null;
}

export function countryFromName(name: string): string | null {
  return BY_NAME.get(name.trim().toLowerCase()) ?? null;
}
