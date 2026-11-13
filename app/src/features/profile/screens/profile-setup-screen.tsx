import { useState } from 'react';

import { useTranslation } from '@/shared/i18n';
import { Button, Input, Screen, Text } from '@/shared/ui';

import { useCompleteProfile } from '../api/complete-profile';
import { useOwnProfile } from '../api/my-profile';
import { OnboardingError } from '../api/set-birthdate';
import { AvatarPicker } from '../components/avatar-picker';
import { UsernameField } from '../components/username-field';
import { displayNameSchema, isValidUsername } from '../lib/validation';

export function ProfileSetupScreen() {
  const { t } = useTranslation();
  const { data: profile } = useOwnProfile();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [avatarPath, setAvatarPath] = useState<string | null>(profile?.avatar_path ?? null);
  const [nameError, setNameError] = useState(false);
  const complete = useCompleteProfile();

  const reason = complete.error instanceof OnboardingError ? complete.error.reason : null;
  const usernameError =
    reason === 'username_taken'
      ? t('onboarding.profile.usernameTaken')
      : reason === 'invalid_username'
        ? t('onboarding.profile.usernameRules')
        : undefined;

  const onSubmit = () => {
    const name = displayNameSchema.safeParse(displayName);
    setNameError(!name.success);
    if (!name.success || !isValidUsername(username) || !profile) return;
    complete.mutate({ userId: profile.id, username, displayName: name.data, avatarPath });
  };

  return (
    <Screen scroll>
      <Text variant="title" accessibilityRole="header">
        {t('onboarding.profile.title')}
      </Text>
      <Text muted>{t('onboarding.profile.subtitle')}</Text>

      {profile ? (
        <AvatarPicker userId={profile.id} name={displayName} path={avatarPath} onChange={setAvatarPath} />
      ) : null}

      <UsernameField
        value={username}
        onChangeText={(value) => {
          complete.reset();
          setUsername(value);
        }}
        error={usernameError}
      />
      <Input
        label={t('onboarding.profile.displayName')}
        placeholder={t('onboarding.profile.displayNamePlaceholder')}
        value={displayName}
        onChangeText={(value) => {
          setNameError(false);
          setDisplayName(value);
        }}
        autoComplete="name"
        maxLength={50}
        error={nameError ? t('onboarding.profile.displayNameRequired') : undefined}
      />

      {complete.error && !usernameError ? (
        <Text accessibilityRole="alert">{t('auth.errors.generic')}</Text>
      ) : null}

      <Button
        title={t('onboarding.profile.submit')}
        onPress={onSubmit}
        loading={complete.isPending}
        disabled={!isValidUsername(username)}
      />
    </Screen>
  );
}
