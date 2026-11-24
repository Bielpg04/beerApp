import { Stack } from 'expo-router';

import { FriendRequestsScreen } from '@/features/social';
import { useTranslation } from '@/shared/i18n';

export default function FriendRequestsRoute() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t('social.requests.title') }} />
      <FriendRequestsScreen />
    </>
  );
}
