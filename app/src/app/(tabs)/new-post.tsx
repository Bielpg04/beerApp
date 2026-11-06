import { useTranslation } from '@/shared/i18n';
import { EmptyState } from '@/shared/ui';

export default function NewPostScreen() {
  const { t } = useTranslation();
  return <EmptyState emoji="📸" title={t('tabs.newPost')} message={t('common.comingSoon')} />;
}
