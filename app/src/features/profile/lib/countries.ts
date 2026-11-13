import type { Language } from '@/shared/i18n';

export interface Country {
  code: string;
  name: Record<Language, string>;
}

// Europe + United States (the regions BeerApp covers).
const DATA: [code: string, ca: string, es: string, en: string][] = [
  ['AD', 'Andorra', 'Andorra', 'Andorra'],
  ['AL', 'Albània', 'Albania', 'Albania'],
  ['AT', 'Àustria', 'Austria', 'Austria'],
  ['BA', 'Bòsnia i Hercegovina', 'Bosnia y Herzegovina', 'Bosnia and Herzegovina'],
  ['BE', 'Bèlgica', 'Bélgica', 'Belgium'],
  ['BG', 'Bulgària', 'Bulgaria', 'Bulgaria'],
  ['CH', 'Suïssa', 'Suiza', 'Switzerland'],
  ['CY', 'Xipre', 'Chipre', 'Cyprus'],
  ['CZ', 'Txèquia', 'Chequia', 'Czechia'],
  ['DE', 'Alemanya', 'Alemania', 'Germany'],
  ['DK', 'Dinamarca', 'Dinamarca', 'Denmark'],
  ['EE', 'Estònia', 'Estonia', 'Estonia'],
  ['ES', 'Espanya', 'España', 'Spain'],
  ['FI', 'Finlàndia', 'Finlandia', 'Finland'],
  ['FR', 'França', 'Francia', 'France'],
  ['GB', 'Regne Unit', 'Reino Unido', 'United Kingdom'],
  ['GR', 'Grècia', 'Grecia', 'Greece'],
  ['HR', 'Croàcia', 'Croacia', 'Croatia'],
  ['HU', 'Hongria', 'Hungría', 'Hungary'],
  ['IE', 'Irlanda', 'Irlanda', 'Ireland'],
  ['IS', 'Islàndia', 'Islandia', 'Iceland'],
  ['IT', 'Itàlia', 'Italia', 'Italy'],
  ['LI', 'Liechtenstein', 'Liechtenstein', 'Liechtenstein'],
  ['LT', 'Lituània', 'Lituania', 'Lithuania'],
  ['LU', 'Luxemburg', 'Luxemburgo', 'Luxembourg'],
  ['LV', 'Letònia', 'Letonia', 'Latvia'],
  ['MC', 'Mònaco', 'Mónaco', 'Monaco'],
  ['MD', 'Moldàvia', 'Moldavia', 'Moldova'],
  ['ME', 'Montenegro', 'Montenegro', 'Montenegro'],
  ['MK', 'Macedònia del Nord', 'Macedonia del Norte', 'North Macedonia'],
  ['MT', 'Malta', 'Malta', 'Malta'],
  ['NL', 'Països Baixos', 'Países Bajos', 'Netherlands'],
  ['NO', 'Noruega', 'Noruega', 'Norway'],
  ['PL', 'Polònia', 'Polonia', 'Poland'],
  ['PT', 'Portugal', 'Portugal', 'Portugal'],
  ['RO', 'Romania', 'Rumanía', 'Romania'],
  ['RS', 'Sèrbia', 'Serbia', 'Serbia'],
  ['SE', 'Suècia', 'Suecia', 'Sweden'],
  ['SI', 'Eslovènia', 'Eslovenia', 'Slovenia'],
  ['SK', 'Eslovàquia', 'Eslovaquia', 'Slovakia'],
  ['SM', 'San Marino', 'San Marino', 'San Marino'],
  ['UA', 'Ucraïna', 'Ucrania', 'Ukraine'],
  ['US', 'Estats Units', 'Estados Unidos', 'United States'],
  ['XK', 'Kosovo', 'Kosovo', 'Kosovo'],
];

export const COUNTRIES: Country[] = DATA.map(([code, ca, es, en]) => ({ code, name: { ca, es, en } }));

export function countriesSortedFor(language: Language): Country[] {
  return [...COUNTRIES].sort((a, b) => a.name[language].localeCompare(b.name[language], language));
}

export const findCountry = (code: string | null | undefined) => COUNTRIES.find((c) => c.code === code);
