import { router } from 'expo-router';

import { useTranslation } from '@/shared/i18n';
import { Button } from '@/shared/ui';

/** "Blocked users" on my profile. */
export function BlockedUsersLink() {
  const { t } = useTranslation();
  return <Button title={t('social.blocked.title')} variant="ghost" onPress={() => router.push('/blocked')} />;
}
