import { COUNTRIES, isOldEnough, minDrinkingAge, parseBirthdate } from '..';

describe('minDrinkingAge', () => {
  it('is 21 in the US and 18 elsewhere', () => {
    expect(minDrinkingAge('US')).toBe(21);
    expect(minDrinkingAge('us')).toBe(21);
    expect(minDrinkingAge('ES')).toBe(18);
  });
});

describe('isOldEnough', () => {
  const today = new Date('2026-11-13');

  it('accepts someone who turns 18 today', () => {
    expect(isOldEnough(new Date('2008-11-13'), 'ES', today)).toBe(true);
  });

  it('rejects someone who turns 18 tomorrow', () => {
    expect(isOldEnough(new Date('2008-11-14'), 'ES', today)).toBe(false);
  });

  it('needs 21 in the US', () => {
    expect(isOldEnough(new Date('2006-01-01'), 'US', today)).toBe(false);
    expect(isOldEnough(new Date('2005-11-13'), 'US', today)).toBe(true);
  });

  it('handles people born on 29 February', () => {
    // Turns 18 on 1 March 2026 (no 29 Feb that year)
    expect(isOldEnough(new Date('2008-02-29'), 'ES', new Date('2026-02-28'))).toBe(false);
    expect(isOldEnough(new Date('2008-02-29'), 'ES', new Date('2026-03-01'))).toBe(true);
  });
});

describe('parseBirthdate', () => {
  it('builds a UTC date from day, month and year', () => {
    expect(parseBirthdate('20', '5', '2000')?.toISOString().slice(0, 10)).toBe('2000-05-20');
  });

  it.each([
    ['31', '2', '2000'],
    ['0', '1', '2000'],
    ['10', '13', '2000'],
    ['10', '1', '99'],
    ['', '', ''],
    ['10', '1', '1850'],
  ])('rejects %s/%s/%s', (d, m, y) => {
    expect(parseBirthdate(d, m, y)).toBeNull();
  });
});

describe('COUNTRIES', () => {
  it('includes Spain and the US with names in every language', () => {
    for (const code of ['ES', 'US', 'AD', 'DE']) {
      const country = COUNTRIES.find((c) => c.code === code);
      expect(country?.name.ca && country.name.es && country.name.en).toBeTruthy();
    }
  });

  it('has unique, upper-case two-letter codes', () => {
    const codes = COUNTRIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.every((c) => /^[A-Z]{2}$/.test(c))).toBe(true);
  });
});
