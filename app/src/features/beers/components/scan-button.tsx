import { router } from 'expo-router';

import { useTranslation } from '@/shared/i18n';
import { Button } from '@/shared/ui';

export function ScanButton() {
  const { t } = useTranslation();
  return <Button title={t('beers.scan.open')} onPress={() => router.push('/scan')} />;
}
