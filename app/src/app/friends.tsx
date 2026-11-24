import { Stack } from 'expo-router';

import { FriendsScreen } from '@/features/social';
import { useTranslation } from '@/shared/i18n';

export default function FriendsRoute() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t('social.friends.title') }} />
      <FriendsScreen />
    </>
  );
}
