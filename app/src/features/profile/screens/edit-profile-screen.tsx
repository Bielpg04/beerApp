import { router } from 'expo-router';
import { useState } from 'react';
import { Switch, View } from 'react-native';

import { type Language, useTranslation } from '@/shared/i18n';
import { useTheme } from '@/shared/theme';
import { Button, Card, Input, Screen, Sheet, Text } from '@/shared/ui';

import { useOwnProfile } from '../api/my-profile';
import { useUpdateProfile } from '../api/update-profile';
import { AvatarPicker } from '../components/avatar-picker';
import { findCountry } from '../lib/countries';
import { bioSchema, displayNameSchema } from '../lib/validation';
import type { MyProfile } from '../types';

export interface EditProfileScreenProps {
  /** Injected by the route so this feature doesn't depend on the auth feature. */
  onSignOut: () => void;
}

export function EditProfileScreen({ onSignOut }: EditProfileScreenProps) {
  const { data: profile } = useOwnProfile();
  if (!profile) return <Screen />;
  return <EditProfileForm profile={profile} onSignOut={onSignOut} />;
}

function EditProfileForm({ profile, onSignOut }: { profile: MyProfile } & EditProfileScreenProps) {
  const { t, i18n } = useTranslation();
  const { colors, spacing } = useTheme();
  const [displayName, setDisplayName] = useState(profile.display_name ?? '');
  const [bio, setBio] = useState(profile.bio ?? '');
  const [avatarPath, setAvatarPath] = useState(profile.avatar_path);
  const [isPrivate, setIsPrivate] = useState(profile.is_private);
  const [errors, setErrors] = useState<{ name?: boolean; bio?: boolean }>({});
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const update = useUpdateProfile(profile.id);

  const onSave = () => {
    const name = displayNameSchema.safeParse(displayName);
    const about = bioSchema.safeParse(bio.trim());
    setErrors({ name: !name.success, bio: !about.success });
    if (!name.success || !about.success) return;
    update.mutate(
      { display_name: name.data, bio: about.data || null, avatar_path: avatarPath, is_private: isPrivate },
      { onSuccess: () => router.back() },
    );
  };

  const birthdate = profile.birthdate
    ? new Date(`${profile.birthdate}T00:00:00Z`).toLocaleDateString(i18n.language, { timeZone: 'UTC' })
    : '';

  return (
    <Screen scroll>
      <Text variant="title" accessibilityRole="header">
        {t('profile.editTitle')}
      </Text>

      <AvatarPicker userId={profile.id} name={displayName} path={avatarPath} onChange={setAvatarPath} />

      <Input
        label={t('onboarding.profile.displayName')}
        value={displayName}
        onChangeText={setDisplayName}
        maxLength={50}
        error={errors.name ? t('onboarding.profile.displayNameRequired') : undefined}
      />
      <Input
        label={t('profile.bio')}
        placeholder={t('profile.bioPlaceholder')}
        value={bio}
        onChangeText={setBio}
        multiline
        style={{ minHeight: 88, textAlignVertical: 'top', paddingTop: spacing.sm }}
        error={errors.bio ? t('profile.errors.bioTooLong') : undefined}
      />
      <Text variant="caption" muted style={{ alignSelf: 'flex-end' }}>
        {bio.trim().length}/160
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Text variant="label">{t('profile.private')}</Text>
          <Text variant="caption" muted>
            {t('profile.privateHint')}
          </Text>
        </View>
        <Switch
          accessibilityLabel={t('profile.private')}
          value={isPrivate}
          onValueChange={setIsPrivate}
          trackColor={{ true: colors.primary }}
        />
      </View>

      <Card>
        <Text>@{profile.username}</Text>
        <Text muted>
          {birthdate} · {findCountry(profile.country)?.name[i18n.language as Language] ?? profile.country}
        </Text>
        <Text variant="caption" muted>
          {t('profile.readOnlyHint')}
        </Text>
      </Card>

      {update.error ? <Text accessibilityRole="alert">{t('auth.errors.generic')}</Text> : null}
      <Button title={t('common.save')} onPress={onSave} loading={update.isPending} />
      <Button title={t('profile.signOut')} variant="ghost" onPress={() => setConfirmSignOut(true)} />

      <Sheet
        visible={confirmSignOut}
        onClose={() => setConfirmSignOut(false)}
        title={t('profile.signOutConfirm')}
      >
        <Button title={t('profile.signOutConfirmYes')} variant="danger" onPress={onSignOut} />
        <Button title={t('common.cancel')} variant="secondary" onPress={() => setConfirmSignOut(false)} />
      </Sheet>
    </Screen>
  );
}
