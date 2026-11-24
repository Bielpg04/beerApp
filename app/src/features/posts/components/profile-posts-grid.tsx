import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { useTranslation } from '@/shared/i18n';
import { useTheme } from '@/shared/theme';
import { Button, Text } from '@/shared/ui';

import { useThumbUrls } from '../api/thumbs';
import { useUserPosts } from '../api/user-posts';
import { formatConsumedAt } from '../lib/format';
import type { Post } from '../types';

export interface ProfilePostsGridProps {
  userId: string;
  /** My own profile: an empty grid invites me to log a beer. */
  isMe?: boolean;
}

/** A profile's posts as a 3-column grid, 30 at a time. */
export function ProfilePostsGrid({ userId, isMe = false }: ProfilePostsGridProps) {
  const { t } = useTranslation();
  const query = useUserPosts(userId);
  const posts = useMemo(() => query.data?.pages.flatMap((page) => page.posts) ?? [], [query.data]);
  const thumbPaths = useMemo(
    () => posts.flatMap((post) => (post.photo ? [post.photo.thumbPath] : [])),
    [posts],
  );
  const thumbs = useThumbUrls(thumbPaths);

  if (query.isError) {
    return <Button title={t('common.retry')} variant="secondary" onPress={() => void query.refetch()} />;
  }
  if (query.isPending) return null;
  if (posts.length === 0) {
    return isMe ? (
      <View style={{ gap: 8 }}>
        <Text muted>{t('posts.grid.emptyMine')}</Text>
        <Button
          title={t('posts.mine.logFirst')}
          variant="secondary"
          onPress={() => router.push('/new-post')}
        />
      </View>
    ) : (
      <Text muted>{t('posts.grid.empty')}</Text>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -1 }}>
        {posts.map((post) => (
          <Tile
            key={post.id}
            post={post}
            thumb={post.photo ? (thumbs.data?.[post.photo.thumbPath] ?? null) : null}
          />
        ))}
      </View>
      {query.hasNextPage ? (
        <Button
          title={t('posts.grid.more')}
          variant="secondary"
          loading={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
        />
      ) : null}
    </View>
  );
}

function Tile({ post, thumb }: { post: Post; thumb: string | null }) {
  const { i18n } = useTranslation();
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${post.beer.name}, ${formatConsumedAt(post.consumedAt, i18n.language)}`}
      onPress={() => router.push(`/post/${post.id}`)}
      style={{ width: '33.333%', aspectRatio: 1, padding: 1 }}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: colors.surfaceAlt,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          overflow: 'hidden',
        }}
      >
        {thumb ? (
          <Image
            testID="post-thumb"
            source={thumb}
            contentFit="cover"
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
          />
        ) : (
          <>
            {post.beer.imageThumbUrl ? (
              <Image
                source={post.beer.imageThumbUrl}
                contentFit="contain"
                style={{ width: 48, height: 48 }}
              />
            ) : (
              <Text>🍺</Text>
            )}
            <Text variant="caption" numberOfLines={2} style={{ textAlign: 'center', paddingHorizontal: 6 }}>
              {post.beer.name}
            </Text>
          </>
        )}
      </View>
    </Pressable>
  );
}
