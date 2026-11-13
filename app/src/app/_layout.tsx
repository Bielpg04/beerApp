import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { useRouteState } from '@/features/auth';
import { myProfileKey } from '@/features/profile';
import { useTranslation } from '@/shared/i18n';
import { QueryProvider, queryClient } from '@/shared/lib/query-client';
import { Button, EmptyState } from '@/shared/ui';

void SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const state = useRouteState();

  useEffect(() => {
    if (state !== 'loading') void SplashScreen.hideAsync();
  }, [state]);

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
  return (
    <QueryProvider>
      <RootNavigator />
    </QueryProvider>
  );
}
