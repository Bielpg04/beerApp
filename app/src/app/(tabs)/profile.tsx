import { useTranslation } from '@/shared/i18n';
import { EmptyState } from '@/shared/ui';

export default function ProfileScreen() {
  const { t } = useTranslation();
  return <EmptyState emoji="👤" title={t('tabs.profile')} message={t('common.comingSoon')} />;
}
