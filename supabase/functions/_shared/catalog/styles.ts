/**
 * Beer style from OFF categories (or, as a fallback, the beer's name).
 * OFF tags are irregular ("en:pale-ales", "ca:cervesa-ipa", "fr:Bières Porter"),
 * so styles are matched by keywords, in priority order (same order as
 * public.beer_styles.sort_order). Keywords also match their plural ("…s").
 */
const STYLE_KEYWORDS: [string, string[]][] = [
  [
    'non_alcoholic',
    [
      'non alcoholic',
      'alcohol free',
      'sin alcohol',
      'sense alcohol',
      'sans alcool',
      'alkoholfrei',
      'alcoholvrij',
      'low alcohol',
      '0 0',
    ],
  ],
  ['trappist', ['trappist', 'trappiste']],
  ['abbey', ['abbey', 'abbaye', 'abdij', 'abadia', 'tripel', 'dubbel', 'quadrupel']],
  ['sour', ['sour', 'lambic', 'gueuze', 'geuze', 'gose', 'berliner weisse', 'flanders red']],
  ['fruit', ['fruit', 'kriek', 'framboise', 'frambozen']],
  ['witbier', ['witbier', 'wit', 'white beer', 'biere blanche', 'blanche']],
  ['wheat', ['wheat', 'weiss', 'weisse', 'weizen', 'weissbier', 'hefeweizen', 'weizenbier', 'trigo', 'blat']],
  ['ipa', ['ipa', 'india pale ale', 'neipa']],
  ['pale_ale', ['pale ale', 'apa', 'bitter', 'esb']],
  ['saison', ['saison']],
  ['bock', ['bock', 'doppelbock', 'bok']],
  ['stout', ['stout']],
  ['porter', ['porter']],
  ['pilsner', ['pils', 'pilsner', 'pilsener']],
  ['amber', ['amber', 'ambar', 'ambree', 'red ale', 'rousse', 'marzen']],
  ['blonde', ['blonde', 'blond', 'rubia', 'golden ale', 'doree']],
  ['dark', ['dark', 'black', 'negra', 'brune', 'brown ale', 'schwarzbier', 'dunkel', 'tostada']],
  ['lager', ['lager', 'helles']],
];

export const STYLE_CODES = STYLE_KEYWORDS.map(([code]) => code);

const MATCHERS: [string, RegExp][] = STYLE_KEYWORDS.map(([code, keywords]) => [
  code,
  new RegExp(`(?:^| )(?:${keywords.join('|')})s?(?= |$)`),
]);

function plain(text: string): string {
  return text
    .replace(/^[a-z]{2}:/i, '') // language prefix of OFF tags
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function styleFromTexts(texts: string[]): string | null {
  const all = texts.map(plain).filter(Boolean);
  for (const [code, re] of MATCHERS) {
    if (all.some((t) => re.test(t))) return code;
  }
  return null;
}

export function styleFromTags(categoriesTags: string[]): string | null {
  return styleFromTexts(categoriesTags);
}

export function styleFromName(name: string): string | null {
  return styleFromTexts([name]);
}
