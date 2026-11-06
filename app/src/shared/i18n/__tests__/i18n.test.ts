import { detectLanguage, i18n, resources, SUPPORTED_LANGUAGES } from '@/shared/i18n';

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe('i18n', () => {
  const reference = keys(resources.ca.translation).sort();

  it.each(SUPPORTED_LANGUAGES)('%s has exactly the same keys as ca', (lang) => {
    expect(keys(resources[lang].translation).sort()).toEqual(reference);
  });

  it.each([
    [['ca', 'es'], 'ca'],
    [['de', 'es'], 'es'],
    [['fr', null], 'en'],
    [[], 'en'],
  ] as const)('detectLanguage(%j) = %s', (device, expected) => {
    expect(detectLanguage([...device])).toBe(expected);
  });

  it('translates keys', async () => {
    await i18n.changeLanguage('ca');
    expect(i18n.t('tabs.search')).toBe('Cerca');
    await i18n.changeLanguage('en');
    expect(i18n.t('tabs.search')).toBe('Search');
  });
});
