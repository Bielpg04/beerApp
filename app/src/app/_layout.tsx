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

import { useRouteState } from '@/features/auth';
import { myProfileKey } from '@/features/profile';
import { useTranslation } from '@/shared/i18n';
import { QueryProvider, queryClient } from '@/shared/lib/query-client';
import { fonts, ThemeProvider } from '@/shared/theme';
import { Button, EmptyState } from '@/shared/ui';

void SplashScreen.preventAutoHideAsync();

function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const state = useRouteState();
  const ready = fontsReady && state !== 'loading';

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  // Hold the first frame until the fonts are in, so text never reflows.
  if (!fontsReady) return null;

  if (state === 'error') return <ConnectionError />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={state === 'signedOut'}>
        <Stack.Screen name="(auth)/login" />
        <Stack.Screen name="(auth)/verify" />
      </Stack.Protected>
      <Stack.Protected guard={state === 'needsAge'}>
        <Stack.Screen name="onboarding/age" />
      </Stack.Protected>
      <Stack.Protected guard={state === 'needsProfile'}>
        <Stack.Screen name="onboarding/profile" />
      </Stack.Protected>
      <Stack.Protected guard={state === 'ready'}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="profile-edit" options={{ presentation: 'modal' }} />
      </Stack.Protected>
    </Stack>
  );
}

/** Shown when the profile can't be loaded (e.g. offline at launch). */
function ConnectionError() {
  const { t } = useTranslation();
  return (
    <EmptyState emoji="📡" title={t('common.connectionError')} message={t('common.connectionErrorHint')}>
      <Button
        title={t('common.retry')}
        onPress={() => void queryClient.refetchQueries({ queryKey: myProfileKey })}
      />
    </EmptyState>
  );
}

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
  // If a font fails to load, render anyway: text falls back to the system face.
  const fontsReady = loaded || error != null;

  return (
    <QueryProvider>
      <ThemeProvider>
        <RootNavigator fontsReady={fontsReady} />
      </ThemeProvider>
    </QueryProvider>
  );
}
