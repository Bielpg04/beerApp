import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { useTranslation } from '@/shared/i18n';
import { useTheme } from '@/shared/theme';
import { Button, EmptyState, Input, Screen, Text } from '@/shared/ui';

import { usePost } from '../api/post';
import { useUpdatePost } from '../api/update-post';
import { ChoiceChips } from '../components/choice-chips';
import { SERVINGS } from '../components/details-step';
import { FeedToggle } from '../components/feed-toggle';
import { isValidVolume, VolumeField } from '../components/volume-field';
import { WhenField } from '../components/when-field';
import type { Post, Serving } from '../types';

export function EditPostScreen({ id }: { id: string }) {
  const { t } = useTranslation();
  const query = usePost(id);
  if (query.isPending) return <EmptyState emoji="🍺" title={t('common.loading')} />;
  if (!query.data) return <EmptyState emoji="🤷" title={t('posts.notFound')} />;
  return <EditPostForm post={query.data} />;
}

function EditPostForm({ post }: { post: Post }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const update = useUpdatePost(post.id);
  const [serving, setServing] = useState<Serving>(post.serving);
  const [volumeMl, setVolumeMl] = useState(post.volumeMl);
  const [caption, setCaption] = useState(post.caption ?? '');
  /** null = now, as in the create flow. */
  const [consumedAt, setConsumedAt] = useState<string | null>(post.consumedAt);
  const [publishToFeed, setPublishToFeed] = useState(post.publishToFeed);
  const dateLocked = post.verificationLevel === 'verified';

  const save = () =>
    update.mutate(
      { serving, volumeMl, caption, consumedAt: consumedAt ?? new Date().toISOString(), publishToFeed },
      { onSuccess: () => router.back() },
    );

  return (
    <Screen scroll>
      <Text variant="title" accessibilityRole="header">
        {t('posts.edit.title')}
      </Text>
      <View style={{ gap: 4 }}>
        <Text variant="subtitle">{post.beer.name}</Text>
        <Text muted>{post.beer.brand}</Text>
        <Text variant="caption" muted>
          {t('posts.edit.beerFixed')}
        </Text>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text variant="label">{t('posts.new.serving')}</Text>
        <ChoiceChips
          choices={SERVINGS.map((value) => ({ value, label: t(`posts.serving.${value}`) }))}
          value={serving}
          onChange={setServing}
        />
      </View>
      <VolumeField value={volumeMl} onChange={setVolumeMl} />

      {dateLocked ? (
        <Text muted>{t('posts.edit.dateLocked')}</Text>
      ) : (
        <WhenField value={consumedAt} onChange={setConsumedAt} />
      )}
      <FeedToggle consumedAt={consumedAt} value={publishToFeed} onChange={setPublishToFeed} />

      <Input
        label={t('posts.new.caption')}
        placeholder={t('posts.new.captionPlaceholder')}
        value={caption}
        onChangeText={setCaption}
        multiline
        maxLength={500}
        style={{ minHeight: 88, textAlignVertical: 'top', paddingTop: spacing.sm }}
      />

      {update.isError ? <Text accessibilityRole="alert">{t('posts.edit.saveError')}</Text> : null}
      <Button
        title={t('common.save')}
        onPress={save}
        loading={update.isPending}
        disabled={!isValidVolume(volumeMl)}
      />
      <Button title={t('common.cancel')} variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
