import { bioSchema, displayNameSchema, normalizeUsername, usernameSchema } from '..';

describe('normalizeUsername', () => {
  it('trims and lower-cases', () => {
    expect(normalizeUsername('  Biel ')).toBe('biel');
    expect(normalizeUsername('Biel_04')).toBe('biel_04');
  });
});

describe('usernameSchema', () => {
  it.each(['pèl', '.biel', 'biel.', 'ab', 'Biel', 'biel palomar', 'a'.repeat(21)])('rejects %j', (u) => {
    expect(usernameSchema.safeParse(u).success).toBe(false);
  });
  it.each(['biel_04', 'b.p', 'abc', 'a'.repeat(20)])('accepts %j', (u) => {
    expect(usernameSchema.safeParse(u).success).toBe(true);
  });
});

describe('displayNameSchema', () => {
  it('trims and requires 1–50 characters', () => {
    expect(displayNameSchema.parse('  Biel ')).toBe('Biel');
    expect(displayNameSchema.safeParse('   ').success).toBe(false);
    expect(displayNameSchema.safeParse('a'.repeat(51)).success).toBe(false);
  });
});

describe('bioSchema', () => {
  it('allows up to 160 characters', () => {
    expect(bioSchema.safeParse('a'.repeat(160)).success).toBe(true);
    expect(bioSchema.safeParse('a'.repeat(161)).success).toBe(false);
  });
});
