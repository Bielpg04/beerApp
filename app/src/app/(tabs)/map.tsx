import { useTranslation } from '@/shared/i18n';
import { EmptyState } from '@/shared/ui';

export default function MapScreen() {
  const { t } = useTranslation();
  return <EmptyState emoji="🗺️" title={t('tabs.map')} message={t('common.comingSoon')} />;
}
