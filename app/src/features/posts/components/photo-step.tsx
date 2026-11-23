import { View } from 'react-native';

import { useTranslation } from '@/shared/i18n';
import { Button, Text } from '@/shared/ui';

export function PhotoStep({ onSkip }: { onSkip: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={{ gap: 12 }}>
      <Text muted>{t('posts.new.photoHint')}</Text>
      <Button title={t('posts.new.noPhoto')} variant="secondary" onPress={onSkip} />
    </View>
  );
}
