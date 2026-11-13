import { useTranslation } from '@/shared/i18n';
import { EmptyState } from '@/shared/ui';

// Placeholder until US-103-T2.
export default function ProfileStep() {
  const { t } = useTranslation();
  return <EmptyState emoji="🙂" title={t('onboarding.profile.title')} message={t('common.comingSoon')} />;
}
