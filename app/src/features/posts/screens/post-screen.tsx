import { Image } from 'expo-image';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { useTranslation } from '@/shared/i18n';
import { useTheme } from '@/shared/theme';
import { Button, Card, EmptyState, Screen, Text } from '@/shared/ui';

import { usePhotoUrl } from '../api/photos';
import { usePost } from '../api/post';
import { formatConsumedAt, formatServing } from '../lib/format';
import type { Post } from '../types';

export interface PostScreenProps {
  id: string;
  /** Composed by the route (edit/delete for the author). */
  renderActions?: (post: Post) => ReactNode;
}

export function PostScreen({ id, renderActions }: PostScreenProps) {
  const { t } = useTranslation();
  const query = usePost(id);

  if (query.isError) {
    return (
      <EmptyState emoji="📡" title={t('common.connectionError')} message={t('common.connectionErrorHint')}>
        <Button title={t('common.retry')} onPress={() => void query.refetch()} />
      </EmptyState>
    );
  }
  if (query.isPending) return <EmptyState emoji="🍺" title={t('common.loading')} />;
  if (!query.data) return <EmptyState emoji="🤷" title={t('posts.notFound')} />;
  return <PostDetails post={query.data} actions={renderActions?.(query.data)} />;
}

function PostDetails({ post, actions }: { post: Post; actions: ReactNode }) {
  const { t, i18n } = useTranslation();

  return (
    <Screen scroll>
      {post.photo ? <PostPhotoView post={post} /> : null}

      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${post.beer.name}, ${post.beer.brand}`}
        onPress={() => router.push(`/beer/${post.beer.id}`)}
        style={{ gap: 4 }}
      >
        <Text variant="title" accessibilityRole="header">
          {post.beer.name}
        </Text>
        <Text muted>{post.beer.brand}</Text>
      </Pressable>

      <Card>
        <Text>{formatServing(post.serving, post.volumeMl, t)}</Text>
        <Text muted>{formatConsumedAt(post.consumedAt, i18n.language)}</Text>
        {post.isRetroactive || !post.publishToFeed ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {post.isRetroactive ? <Tag label={t('posts.retroactive')} /> : null}
            {!post.publishToFeed ? <Tag label={t('posts.notOnFeed')} /> : null}
          </View>
        ) : null}
      </Card>

      {post.caption ? <Text>{post.caption}</Text> : null}

      {actions}
    </Screen>
  );
}

function PostPhotoView({ post }: { post: Post }) {
  const { t } = useTranslation();
  const { colors, radius } = useTheme();
  const url = usePhotoUrl(post.photo?.path ?? null);
  const photo = post.photo;
  if (!photo) return null;

  return (
    <View
      style={{
        aspectRatio: photo.width / photo.height,
        maxHeight: 520,
        borderRadius: radius.lg,
        overflow: 'hidden',
        backgroundColor: colors.surface,
      }}
    >
      {url.data ? (
        <Image
          source={url.data}
          contentFit="cover"
          accessible
          accessibilityLabel={t('posts.photoLabel', { name: post.beer.name })}
          style={{ flex: 1 }}
        />
      ) : null}
    </View>
  );
}

function Tag({ label }: { label: string }) {
  const { colors, radius } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.surfaceAlt,
        borderRadius: radius.full,
        paddingHorizontal: 10,
        paddingVertical: 4,
      }}
    >
      <Text variant="caption">{label}</Text>
    </View>
  );
}
