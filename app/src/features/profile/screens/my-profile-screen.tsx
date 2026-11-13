import { router } from 'expo-router';
import { View } from 'react-native';

import { useTranslation } from '@/shared/i18n';
import { Avatar, Button, Screen, Text } from '@/shared/ui';

import { avatarUrl } from '../api/avatar';
import { useOwnProfile } from '../api/my-profile';

export function MyProfileScreen() {
  const { t } = useTranslation();
  const { data: profile } = useOwnProfile();
  if (!profile) return <Screen />;

  const name = profile.display_name ?? profile.username ?? '';
  return (
    <Screen scroll>
      <View style={{ alignItems: 'center', gap: 8 }}>
        <Avatar name={name} uri={avatarUrl(profile.avatar_path)} size={96} />
        <Text variant="title" accessibilityRole="header">
          {name}
        </Text>
        <Text muted>@{profile.username}</Text>
        <Text style={{ textAlign: 'center' }} muted={!profile.bio}>
          {profile.bio || t('profile.noBio')}
        </Text>
      </View>
      <Button title={t('profile.edit')} variant="secondary" onPress={() => router.push('/profile-edit')} />
    </Screen>
  );
}
