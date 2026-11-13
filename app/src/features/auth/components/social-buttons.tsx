import { useState } from 'react';
import { View } from 'react-native';

import { useTranslation } from '@/shared/i18n';
import { Button, Text } from '@/shared/ui';

import { googleConfigFromEnv, isGoogleConfigured, signInWithGoogle, type GoogleConfig } from '../api/google';
import { authErrorKey, type AuthErrorKey } from '../lib/auth-error';

export interface SocialButtonsProps {
  google?: GoogleConfig;
}

/** Sign-in buttons for the providers configured in this build; renders nothing otherwise. */
export function SocialButtons({ google = googleConfigFromEnv() }: SocialButtonsProps) {
  const { t } = useTranslation();
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [busy, setBusy] = useState(false);
  const showGoogle = isGoogleConfigured(google);
  if (!showGoogle) return null;

  const run = async (signIn: () => Promise<'ok' | 'cancelled'>) => {
    setError(null);
    setBusy(true);
    try {
      await signIn(); // the root layout redirects once the session changes
    } catch (e) {
      setError(authErrorKey(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <Button
        title={t('auth.login.google')}
        variant="secondary"
        loading={busy}
        onPress={() => void run(() => signInWithGoogle(google))}
      />
      {error ? <Text accessibilityRole="alert">{t(error)}</Text> : null}
      <Text muted style={{ textAlign: 'center' }}>
        {t('auth.login.or')}
      </Text>
    </View>
  );
}
