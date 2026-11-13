import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { useTranslation } from '@/shared/i18n';
import { Button, Text } from '@/shared/ui';

import { isAppleAvailable, signInWithApple, type AppleOptions } from '../api/apple';
import { googleConfigFromEnv, isGoogleConfigured, signInWithGoogle, type GoogleConfig } from '../api/google';
import { authErrorKey, type AuthErrorKey } from '../lib/auth-error';

export interface SocialButtonsProps {
  google?: GoogleConfig;
  apple?: AppleOptions;
}

type AppleModule = typeof import('expo-apple-authentication');

/** Apple's official button (required by its guidelines); its module is only loaded on iOS. */
function AppleButton({ onPress }: { onPress: () => void }) {
  const { AppleAuthenticationButton, AppleAuthenticationButtonStyle, AppleAuthenticationButtonType } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- iOS-only native module
    require('expo-apple-authentication') as AppleModule;
  return (
    <AppleAuthenticationButton
      buttonType={AppleAuthenticationButtonType.CONTINUE}
      buttonStyle={AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={12}
      style={{ height: 48 }}
      onPress={onPress}
    />
  );
}

/** Sign-in buttons for the providers configured in this build; renders nothing otherwise. */
export function SocialButtons({ google = googleConfigFromEnv(), apple }: SocialButtonsProps) {
  const { t } = useTranslation();
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [showApple, setShowApple] = useState(false);
  const showGoogle = isGoogleConfigured(google);

  useEffect(() => {
    let active = true;
    void isAppleAvailable(apple).then((available) => active && setShowApple(available));
    return () => {
      active = false;
    };
  }, [apple]);

  if (!showGoogle && !showApple) return null;

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
      {showApple ? <AppleButton onPress={() => void run(signInWithApple)} /> : null}
      {showGoogle ? (
        <Button
          title={t('auth.login.google')}
          variant="secondary"
          loading={busy}
          onPress={() => void run(() => signInWithGoogle(google))}
        />
      ) : null}
      {error ? <Text accessibilityRole="alert">{t(error)}</Text> : null}
      <Text muted style={{ textAlign: 'center' }}>
        {t('auth.login.or')}
      </Text>
    </View>
  );
}
