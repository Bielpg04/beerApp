/** Design tokens. Amber/beer palette, light and dark. */

const palette = {
  amber50: '#FFF8E6',
  amber100: '#FDEBC0',
  amber400: '#F2B42C',
  amber500: '#E09A12',
  amber600: '#B87A0A',
  amber700: '#8A5A08',
  stout900: '#1A1410',
  stout800: '#241C16',
  stout700: '#30261E',
  stout600: '#4A3D33',
  foam50: '#FFFDF8',
  foam100: '#F6F1E8',
  foam200: '#EAE2D4',
  gray400: '#9A8F84',
  gray600: '#6B6158',
  red500: '#D64545',
  red400: '#E86A6A',
  green500: '#2F9E5B',
  green400: '#4CC27C',
  yellow500: '#D9A400',
  white: '#FFFFFF',
} as const;

export interface ColorTokens {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryPressed: string;
  onPrimary: string;
  danger: string;
  onDanger: string;
  /** Verification levels: 🟢 verified · 🟡 partial · ⚪ unverified */
  verified: string;
  partial: string;
  unverified: string;
  backdrop: string;
}

export const lightColors: ColorTokens = {
  background: palette.foam50,
  surface: palette.white,
  surfaceAlt: palette.foam100,
  border: palette.foam200,
  text: palette.stout900,
  textMuted: palette.gray600,
  primary: palette.amber500,
  primaryPressed: palette.amber600,
  onPrimary: palette.stout900,
  danger: palette.red500,
  onDanger: palette.white,
  verified: palette.green500,
  partial: palette.yellow500,
  unverified: palette.gray400,
  backdrop: 'rgba(26, 20, 16, 0.45)',
};

export const darkColors: ColorTokens = {
  background: palette.stout900,
  surface: palette.stout800,
  surfaceAlt: palette.stout700,
  border: palette.stout600,
  text: palette.foam100,
  textMuted: palette.gray400,
  primary: palette.amber400,
  primaryPressed: palette.amber500,
  onPrimary: palette.stout900,
  danger: palette.red400,
  onDanger: palette.stout900,
  verified: palette.green400,
  partial: palette.amber400,
  unverified: palette.gray600,
  backdrop: 'rgba(0, 0, 0, 0.6)',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 20, full: 999 } as const;

export const typography = {
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  subtitle: { fontSize: 20, lineHeight: 26, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 18, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
} as const;

export type TypographyVariant = keyof typeof typography;

export interface Theme {
  dark: boolean;
  colors: ColorTokens;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
}

export const lightTheme: Theme = { dark: false, colors: lightColors, spacing, radius, typography };
export const darkTheme: Theme = { dark: true, colors: darkColors, spacing, radius, typography };
