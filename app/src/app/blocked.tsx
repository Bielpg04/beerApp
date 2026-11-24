import { Stack } from 'expo-router';

import { BlockedUsersScreen } from '@/features/social';
import { useTranslation } from '@/shared/i18n';

export default function BlockedRoute() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t('social.blocked.title') }} />
      <BlockedUsersScreen />
    </>
  );
}
