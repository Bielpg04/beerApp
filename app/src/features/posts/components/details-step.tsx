import { View } from 'react-native';

import { useTranslation } from '@/shared/i18n';
import { useTheme } from '@/shared/theme';
import { Button, Input, Text } from '@/shared/ui';

import { usePostDraft } from '../lib/draft';
import { formatConsumedAt } from '../lib/format';
import { RETRO_AFTER_MS } from '../lib/timing';
import type { Serving } from '../types';
import { ChoiceChips } from './choice-chips';
import { FeedToggle } from './feed-toggle';
import { isValidVolume, VolumeField } from './volume-field';
import { WhenField } from './when-field';

export const SERVINGS: Serving[] = ['tap', 'bottle', 'can'];

export function DetailsStep({
  onPublish,
  publishing,
  error,
}: {
  onPublish: () => void;
  publishing: boolean;
  error: string | null;
}) {
  const { t, i18n } = useTranslation();
  const { spacing } = useTheme();
  const draft = usePostDraft();
  const photoDate = suggestedPhotoDate(draft.photo?.exifTakenAt ?? null, draft.consumedAt, new Date());
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

      <VolumeField value={draft.volumeMl} onChange={draft.setVolume} />

      <WhenField value={draft.consumedAt} onChange={draft.setConsumedAt} />
      {photoDate ? (
        <Button
          title={t('posts.when.usePhotoDate', { date: formatConsumedAt(photoDate, i18n.language) })}
          variant="secondary"
          onPress={() => draft.setConsumedAt(photoDate)}
        />
      ) : null}
      <FeedToggle
        consumedAt={draft.consumedAt}
        value={draft.publishToFeed}
        onChange={draft.setPublishToFeed}
      />

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

/** A gallery photo's date is offered when it is in the past, over 1 h from now, and not chosen yet. */
function suggestedPhotoDate(exifTakenAt: string | null, consumedAt: string | null, now: Date): string | null {
  if (!exifTakenAt || exifTakenAt === consumedAt) return null;
  const age = now.getTime() - new Date(exifTakenAt).getTime();
  return age > RETRO_AFTER_MS ? exifTakenAt : null;
}
