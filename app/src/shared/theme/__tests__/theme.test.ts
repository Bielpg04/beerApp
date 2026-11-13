import { contrastTheme, darkTheme, lightTheme, selectTheme } from '@/shared/theme';

function channel(hex: string, offset: number): number {
  const c = parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  return 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
}

function contrast(a: string, b: string): number {
  const hi = Math.max(luminance(a), luminance(b));
  const lo = Math.min(luminance(a), luminance(b));
  return (hi + 0.05) / (lo + 0.05);
}

describe('selectTheme', () => {
  it.each([
    ['light', false, 'light'],
    [null, false, 'light'],
    ['light', true, 'contrast'],
    ['dark', false, 'dark'],
    ['dark', true, 'dark'],
  ] as const)('scheme %s, high contrast %s → %s', (scheme, highContrast, expected) => {
    expect(selectTheme(scheme, highContrast).name).toBe(expected);
  });
});

describe.each([
  [lightTheme, 4.5],
  [darkTheme, 4.5],
  [contrastTheme, 7],
])('$name theme contrast', (theme, minimum) => {
  const c = theme.colors;
  const grounds = [c.background, c.surface, c.surfaceAlt];

  it.each(['text', 'textMuted', 'primaryText', 'danger'] as const)(
    '%s is readable on every surface',
    (role) => {
      for (const ground of grounds) expect(contrast(c[role], ground)).toBeGreaterThanOrEqual(minimum);
    },
  );

  it('labels are readable on their fills', () => {
    expect(contrast(c.onPrimary, c.primary)).toBeGreaterThanOrEqual(minimum);
    expect(contrast(c.onPrimary, c.primaryPressed)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.onDanger, c.danger)).toBeGreaterThanOrEqual(minimum);
  });

  it.each(['borderStrong', 'focus', 'verified', 'partial', 'unverified'] as const)(
    '%s meets 3:1 as a mark on every surface',
    (role) => {
      for (const ground of grounds) expect(contrast(c[role], ground)).toBeGreaterThanOrEqual(3);
    },
  );
});
