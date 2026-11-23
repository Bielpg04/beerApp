import { useState } from 'react';
import { View } from 'react-native';

import { useTranslation } from '@/shared/i18n';
import { useTheme } from '@/shared/theme';
import { Button, Input, Text } from '@/shared/ui';

import { usePostDraft } from '../lib/draft';
import type { Serving } from '../types';
import { ChoiceChips } from './choice-chips';

export const VOLUMES = [200, 330, 500, 568] as const;
const SERVINGS: Serving[] = ['tap', 'bottle', 'can'];
const OTHER = 'other';

export function DetailsStep({
  onPublish,
  publishing,
  error,
}: {
  onPublish: () => void;
  publishing: boolean;
  error: string | null;
}) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const draft = usePostDraft();
  const [otherVolume, setOtherVolume] = useState(
    draft.volumeMl !== null && !VOLUMES.includes(draft.volumeMl as (typeof VOLUMES)[number]),
  );

  const volumeChoice = otherVolume ? OTHER : draft.volumeMl;

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.sm }}>
        <Text variant="label">{t('posts.new.serving')}</Text>
        <ChoiceChips
          choices={SERVINGS.map((value) => ({ value, label: t(`posts.serving.${value}`) }))}
          value={draft.serving}
          onChange={draft.setServing}
        />
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text variant="label">{t('posts.new.volume')}</Text>
        <ChoiceChips<number | typeof OTHER>
          choices={[
            ...VOLUMES.map((value) => ({ value, label: `${value} ml` })),
            { value: OTHER, label: t('posts.new.otherVolume') },
          ]}
          value={volumeChoice}
          onChange={(value) => {
            if (value === OTHER) {
              setOtherVolume(true);
              draft.setVolume(null);
            } else {
              setOtherVolume(false);
              draft.setVolume(value === draft.volumeMl ? null : value);
            }
          }}
        />
        {otherVolume ? (
          <Input
            label={t('posts.new.volumeMl')}
            keyboardType="number-pad"
            maxLength={4}
            value={draft.volumeMl === null ? '' : String(draft.volumeMl)}
            onChangeText={(text) => {
              const digits = text.replace(/\D/g, '');
              draft.setVolume(digits ? Number(digits) : null);
            }}
            error={
              draft.volumeMl !== null && (draft.volumeMl < 50 || draft.volumeMl > 5000)
                ? t('posts.new.volumeRange')
                : undefined
            }
          />
        ) : null}
      </View>

      <Input
        label={t('posts.new.caption')}
        placeholder={t('posts.new.captionPlaceholder')}
        value={draft.caption}
        onChangeText={draft.setCaption}
        multiline
        maxLength={500}
        style={{ minHeight: 88, textAlignVertical: 'top', paddingTop: spacing.sm }}
      />

      {error ? <Text accessibilityRole="alert">{error}</Text> : null}
      <Button
        title={t('posts.new.publish')}
        onPress={onPublish}
        loading={publishing}
        disabled={!draft.serving || !isValidVolume(draft.volumeMl)}
      />
    </View>
  );
}

export function isValidVolume(volumeMl: number | null): boolean {
  return volumeMl === null || (volumeMl >= 50 && volumeMl <= 5000);
}
