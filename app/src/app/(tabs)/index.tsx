import { useTranslation } from '@/shared/i18n';
import { EmptyState } from '@/shared/ui';

export default function FeedScreen() {
  const { t } = useTranslation();
  return <EmptyState emoji="🍻" title={t('tabs.feed')} message={t('common.comingSoon')} />;
}
