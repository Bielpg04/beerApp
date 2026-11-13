import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { useTranslation } from '@/shared/i18n';
import { Button, Input, Screen, Text } from '@/shared/ui';

import { sendEmailCode, verifyEmailCode } from '../api/email';
import { authErrorKey, type AuthErrorKey } from '../lib/auth-error';
import { codeSchema } from '../lib/schemas';

/** Matches Supabase's minimum interval between emails (supabase/config.toml max_frequency). */
export const RESEND_COOLDOWN_SECONDS = 30;

const formSchema = z.object({ code: codeSchema });
type Form = z.infer<typeof formSchema>;

/**
 * Seconds left before another code can be requested. Based on a deadline, so it stays
 * right after the app has been in the background; `restart()` starts a new cooldown.
 */
function useCooldown(seconds: number) {
  const [until, setUntil] = useState(() => Date.now() + seconds * 1000);
  const [now, setNow] = useState(() => Date.now());
  const running = now < until;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);
  const left = Math.max(0, Math.ceil((until - now) / 1000));
  return {
    left,
    restart: () => {
      setUntil(Date.now() + seconds * 1000);
      setNow(Date.now());
    },
  };
}

export function CodeScreen() {
  const { t } = useTranslation();
  const { email = '' } = useLocalSearchParams<{ email: string }>();
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const cooldown = useCooldown(RESEND_COOLDOWN_SECONDS); // a code was just sent
  const { control, handleSubmit, formState } = useForm<Form>({
    resolver: zodResolver(formSchema),
    defaultValues: { code: '' },
  });

  const submitForm = handleSubmit(async ({ code }) => {
    setError(null);
    try {
      await verifyEmailCode(email, code);
      // The root layout redirects once the session changes.
    } catch (e) {
      setError(authErrorKey(e));
    }
  });
  const onSubmit = () => void submitForm();

  const resend = async () => {
    setError(null);
    cooldown.restart();
    try {
      await sendEmailCode(email);
    } catch (e) {
      setError(authErrorKey(e));
    }
  };

  return (
    <Screen style={{ justifyContent: 'center' }}>
      <Text variant="title" accessibilityRole="header">
        {t('auth.code.title')}
      </Text>
      <Text muted>{t('auth.code.subtitle', { email })}</Text>
      <Controller
        control={control}
        name="code"
        render={({ field }) => (
          <Input
            label={t('auth.code.codeLabel')}
            value={field.value}
            onChangeText={(text) => field.onChange(text.replace(/\D/g, '').slice(0, 6))}
            onBlur={field.onBlur}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={6}
            onSubmitEditing={onSubmit}
            error={formState.errors.code ? t('auth.errors.invalidCode') : error ? t(error) : undefined}
          />
        )}
      />
      <Button title={t('auth.code.submit')} onPress={onSubmit} loading={formState.isSubmitting} />
      <Button
        variant="ghost"
        title={
          cooldown.left > 0 ? t('auth.code.resendIn', { seconds: cooldown.left }) : t('auth.code.resend')
        }
        disabled={cooldown.left > 0}
        onPress={() => void resend()}
      />
      <Button variant="ghost" title={t('auth.code.changeEmail')} onPress={() => router.back()} />
    </Screen>
  );
}
