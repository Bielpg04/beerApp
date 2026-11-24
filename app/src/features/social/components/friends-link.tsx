import { router } from 'expo-router';

import { useTranslation } from '@/shared/i18n';
import { Button } from '@/shared/ui';

import { useFriends } from '../api/friends';

/** "Friends · N" on my profile. */
export function FriendsLink() {
  const { t } = useTranslation();
  const { data } = useFriends();
  return (
    <Button
      title={t('social.friends.link', { count: data?.length ?? 0 })}
      variant="secondary"
      onPress={() => router.push('/friends')}
    />
  );
}
