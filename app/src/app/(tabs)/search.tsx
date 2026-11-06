import { useTranslation } from '@/shared/i18n';
import { EmptyState } from '@/shared/ui';

export default function SearchScreen() {
  const { t } = useTranslation();
  return <EmptyState emoji="🔎" title={t('tabs.search')} message={t('common.comingSoon')} />;
}
