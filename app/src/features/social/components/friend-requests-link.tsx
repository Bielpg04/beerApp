import { router } from 'expo-router';

import { useTranslation } from '@/shared/i18n';
import { Button } from '@/shared/ui';

import { useFriendRequests } from '../api/requests';

/** "Friend requests · N" on my profile; hidden when there are none. */
export function FriendRequestsLink() {
  const { t } = useTranslation();
  const { data } = useFriendRequests();
  if (!data?.length) return null;
  return (
    <Button
      title={t('social.requests.link', { count: data.length })}
      onPress={() => router.push('/friend-requests')}
    />
  );
}
