import { useState } from 'react';
import { View } from 'react-native';

import { useTranslation } from '@/shared/i18n';
import { useTheme } from '@/shared/theme';
import { Input, Text } from '@/shared/ui';

import { ChoiceChips } from './choice-chips';

export const VOLUMES = [200, 330, 500, 568] as const;
const OTHER = 'other';

export function isValidVolume(volumeMl: number | null): boolean {
  return volumeMl === null || (volumeMl >= 50 && volumeMl <= 5000);
}

/** Optional volume: common sizes as chips (tap the chosen one again to clear it) or any other. */
export function VolumeField({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const [other, setOther] = useState(value !== null && !VOLUMES.includes(value as (typeof VOLUMES)[number]));

  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="label">{t('posts.new.volume')}</Text>
      <ChoiceChips<number | typeof OTHER>
        choices={[
          ...VOLUMES.map((volume) => ({ value: volume, label: `${volume} ml` })),
          { value: OTHER, label: t('posts.new.otherVolume') },
        ]}
        value={other ? OTHER : value}
        onChange={(choice) => {
          if (choice === OTHER) {
            setOther(true);
            onChange(null);
          } else {
            setOther(false);
            onChange(choice === value ? null : choice);
          }
        }}
      />
      {other ? (
        <Input
          label={t('posts.new.volumeMl')}
          keyboardType="number-pad"
          maxLength={4}
          value={value === null ? '' : String(value)}
          onChangeText={(text) => {
            const digits = text.replace(/\D/g, '');
            onChange(digits ? Number(digits) : null);
          }}
          error={isValidVolume(value) ? undefined : t('posts.new.volumeRange')}
        />
      ) : null}
    </View>
  );
}
