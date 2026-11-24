import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { useTranslation } from '@/shared/i18n';
import { useTheme } from '@/shared/theme';
import { Button, Text } from '@/shared/ui';

import { useMyRecentPosts } from '../api/my-posts';
import { usePhotoUrl } from '../api/photos';
import { formatConsumedAt, formatServing } from '../lib/format';
import type { Post } from '../types';

/** "My latest posts" on my profile: the way back to a post until the history (US-304) exists. */
export function MyRecentPosts({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const posts = useMyRecentPosts(userId);

  return (
    <View style={{ gap: 8 }}>
      <Text variant="subtitle" accessibilityRole="header">
        {t('posts.mine.title')}
      </Text>
      {posts.isError ? (
        <Button title={t('common.retry')} variant="secondary" onPress={() => void posts.refetch()} />
      ) : posts.data?.length === 0 ? (
        <>
          <Text muted>{t('posts.mine.empty')}</Text>
          <Button
            title={t('posts.mine.logFirst')}
            variant="secondary"
            onPress={() => router.push('/new-post')}
          />
        </>
      ) : (
        posts.data?.map((post) => <PostRow key={post.id} post={post} />)
      )}
    </View>
  );
}

function PostRow({ post }: { post: Post }) {
  const { t, i18n } = useTranslation();
  const { colors, radius, spacing } = useTheme();
  const thumb = usePhotoUrl(post.photo?.thumbPath ?? null);
  const image = thumb.data ?? post.beer.imageThumbUrl;
  const when = formatConsumedAt(post.consumedAt, i18n.language);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${post.beer.name}, ${when}`}
      onPress={() => router.push(`/post/${post.id}`)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 64 }}
    >
      {image ? (
        <Image
          source={image}
          contentFit={thumb.data ? 'cover' : 'contain'}
          style={{ width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.surface }}
        />
      ) : (
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: radius.sm,
            backgroundColor: colors.surfaceAlt,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text>🍺</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text variant="label" numberOfLines={1}>
          {post.beer.name}
        </Text>
        <Text variant="caption" muted numberOfLines={1}>
          {formatServing(post.serving, post.volumeMl, t)} · {when}
        </Text>
      </View>
    </Pressable>
  );
}
