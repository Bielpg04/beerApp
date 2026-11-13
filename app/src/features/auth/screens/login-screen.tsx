import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { useTranslation } from '@/shared/i18n';
import { Button, Input, Screen, Text } from '@/shared/ui';

import { sendEmailCode } from '../api/email';
import { authErrorKey, type AuthErrorKey } from '../lib/auth-error';
import { emailSchema } from '../lib/schemas';

const formSchema = z.object({ email: emailSchema });
type Form = z.infer<typeof formSchema>;

export function LoginScreen() {
  const { t } = useTranslation();
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const { control, handleSubmit, formState } = useForm<z.input<typeof formSchema>, unknown, Form>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '' },
  });

  const submitForm = handleSubmit(async ({ email }) => {
    setError(null);
    try {
      await sendEmailCode(email);
      router.push({ pathname: '/code', params: { email } });
    } catch (e) {
      setError(authErrorKey(e));
    }
  });
  const onSubmit = () => void submitForm();

  return (
    <Screen style={{ justifyContent: 'center' }}>
      <Text variant="title" accessibilityRole="header">
        {t('auth.login.title')}
      </Text>
      <Text muted>{t('auth.login.subtitle')}</Text>
      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <Input
            label={t('auth.login.emailLabel')}
            placeholder={t('auth.login.emailPlaceholder')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={onSubmit}
            error={formState.errors.email ? t('auth.errors.invalidEmail') : error ? t(error) : undefined}
          />
        )}
      />
      <Button title={t('auth.login.submit')} onPress={onSubmit} loading={formState.isSubmitting} />
    </Screen>
  );
}
