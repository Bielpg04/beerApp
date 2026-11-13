import { useTranslation } from '@/shared/i18n';
import { EmptyState } from '@/shared/ui';

// Placeholder until US-102-T1.
export default function AgeStep() {
  const { t } = useTranslation();
  return <EmptyState emoji="🎂" title={t('onboarding.age.title')} message={t('common.comingSoon')} />;
}
