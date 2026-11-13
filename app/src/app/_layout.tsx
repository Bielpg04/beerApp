import '@/shared/i18n';

import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { useRouteState } from '@/features/auth';
import { QueryProvider } from '@/shared/lib/query-client';

void SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const state = useRouteState();

  useEffect(() => {
    if (state !== 'loading') void SplashScreen.hideAsync();
  }, [state]);

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

export default function RootLayout() {
  return (
    <QueryProvider>
      <RootNavigator />
    </QueryProvider>
  );
}
