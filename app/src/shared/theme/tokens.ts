/**
 * Design tokens — "Taproom": SRM beer colours, condensed tap-board type, pill controls.
 * Three themes: light, dark and high contrast (light grounds, 7:1 text).
 * Source of truth for the BeerApp design system artifact.
 */

/** Beer colours on the SRM scale. Only for beer swatches and charts, never UI chrome. */
export const srm = {
  2: '#FFD878',
  4: '#FFBF42',
  8: '#F39C00',
  13: '#DE7C00',
  20: '#BB5100',
  29: '#8E2900',
  40: '#36080A',
} as const;

export type SrmStep = keyof typeof srm;

export interface ColorTokens {
  background: string;
  surface: string;
  surfaceAlt: string;
  /** Decorative hairline. Never the only edge of a control. */
  border: string;
  /** Edge of a control (Input, unselected chip): ≥3:1 on every surface. */
  borderStrong: string;
  text: string;
  textMuted: string;
  /** Amber fill. For amber text use `primaryText`. */
  primary: string;
  primaryPressed: string;
  onPrimary: string;
  /** Amber as text: ghost buttons, links, selected chips. */
  primaryText: string;
  focus: string;
  danger: string;
  onDanger: string;
  /** Verification levels: shown with a glyph shape and a word, never colour alone. */
  verified: string;
  partial: string;
  unverified: string;
  backdrop: string;
}

export const lightColors: ColorTokens = {
  background: '#F3F1EF',
  surface: '#FFFFFF',
  surfaceAlt: '#E9E5E1',
  border: '#D9D2CB',
  borderStrong: '#857A71',
  text: '#1C1310',
  textMuted: '#5E5249',
  primary: '#E8901C',
  primaryPressed: '#CF7C10',
  onPrimary: '#1C1310',
  primaryText: '#975608',
  focus: '#975608',
  danger: '#B02E19',
  onDanger: '#FFFFFF',
  verified: '#1A63A1',
  partial: '#765C00',
  unverified: '#7A7068',
  backdrop: 'rgba(28, 19, 16, 0.5)',
};

export const darkColors: ColorTokens = {
  background: '#14100D',
  surface: '#1F1915',
  surfaceAlt: '#2A221D',
  border: '#3B312A',
  borderStrong: '#7F7268',
  text: '#F3EEE9',
  textMuted: '#B3A79C',
  primary: '#F2A23A',
  primaryPressed: '#E0891A',
  onPrimary: '#1C1310',
  primaryText: '#F5B460',
  focus: '#F5B460',
  danger: '#F07A62',
  onDanger: '#1C1310',
  verified: '#6FB0EA',
  partial: '#D9B53A',
  unverified: '#9A8F86',
  backdrop: 'rgba(0, 0, 0, 0.62)',
};

/** Light grounds; every text colour ≥7:1, borders ≥4.9:1. */
export const contrastColors: ColorTokens = {
  ...lightColors,
  border: '#6B6058',
  borderStrong: '#4F453E',
  textMuted: '#40362F',
  primary: '#643D05',
  primaryPressed: '#4A2D03',
  onPrimary: '#FFFFFF',
  primaryText: '#643D05',
  focus: '#643D05',
  danger: '#8A170C',
  onDanger: '#FFFFFF',
  verified: '#084A80',
  partial: '#5A4600',
  unverified: '#5C534C',
  backdrop: 'rgba(28, 19, 16, 0.65)',
};

/** Font family names as registered with expo-font (see app/_layout.tsx). */
export const fonts = {
  displayBold: 'BarlowCondensed_700Bold',
  displayHeavy: 'BarlowCondensed_800ExtraBold',
  body: 'Figtree_400Regular',
  bodyMedium: 'Figtree_500Medium',
  bodySemiBold: 'Figtree_600SemiBold',
  bodyBold: 'Figtree_700Bold',
  mono: 'IBMPlexMono_500Medium',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 4, md: 8, lg: 16, full: 999 } as const;

export const sizes = {
  controlMinHeight: 48,
  avatarDefault: 40,
  swatch: 28,
  sheetHandleWidth: 36,
  sheetHandleHeight: 4,
  emptyStateDisc: 96,
  borderWidth: 1,
  focusWidth: 2,
} as const;

export const opacity = { pressed: 0.88, disabled: 0.45 } as const;

/**
 * Each style names its own font face, so no fontWeight is set:
 * Android doesn't pick a weight across separately registered faces.
 */
export const typography = {
  hero: { fontFamily: fonts.displayHeavy, fontSize: 44, lineHeight: 42, letterSpacing: -0.5 },
  title: { fontFamily: fonts.displayBold, fontSize: 30, lineHeight: 32 },
  subtitle: { fontFamily: fonts.bodyBold, fontSize: 20, lineHeight: 26 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 15, lineHeight: 20 },
  caption: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18 },
  /** ABV, IBU, SRM, ml and prices. */
  data: {
    fontFamily: fonts.mono,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.2,
    fontVariant: ['tabular-nums'],
  },
} as const;

export type TypographyVariant = keyof typeof typography;

export type ThemeName = 'light' | 'dark' | 'contrast';

export interface Theme {
  name: ThemeName;
  dark: boolean;
  colors: ColorTokens;
  spacing: typeof spacing;
  radius: typeof radius;
  sizes: typeof sizes;
  opacity: typeof opacity;
  typography: typeof typography;
}

const shared = { spacing, radius, sizes, opacity, typography };

export const lightTheme: Theme = { name: 'light', dark: false, colors: lightColors, ...shared };
export const darkTheme: Theme = { name: 'dark', dark: true, colors: darkColors, ...shared };
export const contrastTheme: Theme = { name: 'contrast', dark: false, colors: contrastColors, ...shared };

/**
 * High contrast applies on light grounds only: the dark theme already passes AA everywhere,
 * and switching a dark-mode user to a light screen would be jarring.
 */
export function selectTheme(scheme: string | null | undefined, highContrast: boolean): Theme {
  if (scheme === 'dark') return darkTheme;
  return highContrast ? contrastTheme : lightTheme;
}
