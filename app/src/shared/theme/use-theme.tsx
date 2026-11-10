import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, useColorScheme } from 'react-native';

import { selectTheme, type Theme } from './tokens';

/**
 * Whether the OS asks for more contrast:
 * Increase Contrast on iOS, high-contrast text on Android.
 */
export function useHighContrast(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
    const query =
      Platform.OS === 'ios'
        ? AccessibilityInfo.isDarkerSystemColorsEnabled
        : AccessibilityInfo.isHighTextContrastEnabled;
    const event = Platform.OS === 'ios' ? 'darkerSystemColorsChanged' : 'highTextContrastChanged';

    let active = true;
    query?.()
      .then((value) => {
        if (active) setEnabled(value);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener(event, setEnabled);
    return () => {
      active = false;
      subscription?.remove();
    };
  }, []);

  return enabled;
}

const ThemeContext = createContext<Theme | null>(null);

/** Resolves the theme once for the whole tree. Mount it in the root layout. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const highContrast = useHighContrast();
  return <ThemeContext.Provider value={selectTheme(scheme, highContrast)}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  const scheme = useColorScheme();
  // Outside a ThemeProvider (isolated component tests) fall back to the OS scheme.
  return theme ?? selectTheme(scheme, false);
}
