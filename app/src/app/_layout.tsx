import '@/shared/i18n';

import { BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed/700Bold';
import { BarlowCondensed_800ExtraBold } from '@expo-google-fonts/barlow-condensed/800ExtraBold';
import { Figtree_400Regular } from '@expo-google-fonts/figtree/400Regular';
import { Figtree_500Medium } from '@expo-google-fonts/figtree/500Medium';
import { Figtree_600SemiBold } from '@expo-google-fonts/figtree/600SemiBold';
import { Figtree_700Bold } from '@expo-google-fonts/figtree/700Bold';
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono/500Medium';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { fonts, ThemeProvider } from '@/shared/theme';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    [fonts.displayBold]: BarlowCondensed_700Bold,
    [fonts.displayHeavy]: BarlowCondensed_800ExtraBold,
    [fonts.body]: Figtree_400Regular,
    [fonts.bodyMedium]: Figtree_500Medium,
    [fonts.bodySemiBold]: Figtree_600SemiBold,
    [fonts.bodyBold]: Figtree_700Bold,
    [fonts.mono]: IBMPlexMono_500Medium,
  });
  const ready = loaded || error != null;

  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);

  // If a font fails to load, render anyway: text falls back to the system face.
  if (!ready) return null;

  return (
    <ThemeProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}
