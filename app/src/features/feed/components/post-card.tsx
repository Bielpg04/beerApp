import { Image } from 'expo-image';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { formatServing, usePhotoUrl } from '@/features/posts';
import { useTranslation } from '@/shared/i18n';
import { avatarUrl } from '@/shared/lib/avatars';
import { useTheme } from '@/shared/theme';
import { Avatar, Card, Text } from '@/shared/ui';

import { relativeTime } from '../lib/relative-time';
import type { FeedPost } from '../types';

export interface PostCardProps {
  post: FeedPost;
  /** Reactions and comments bar. */
  footer?: ReactNode;
  /** For tests; defaults to the current time. */
  now?: Date;
}

/** A post in the feed: author, photo, beer, when, and the footer the screen adds. */
export function PostCard({ post, footer, now }: PostCardProps) {
  const { t, i18n } = useTranslation();
  const { spacing } = useTheme();
  const name = post.author.displayName ?? post.author.username;
  const open = () => router.push(`/post/${post.id}`);

  return (
    <Card style={{ gap: spacing.md }}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={name}
        onPress={() => router.push(`/user/${post.author.id}`)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
      >
        <Avatar name={name} uri={avatarUrl(post.author.avatarPath)} size={36} />
        <View style={{ flex: 1 }}>
          <Text variant="label" numberOfLines={1}>
            {name}
          </Text>
          <Text variant="caption" muted>
            {relativeTime(post.createdAt, now ?? new Date(), t, i18n.language)}
          </Text>
        </View>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={post.beer.name}
        onPress={open}
        style={{ gap: spacing.sm }}
      >
        {post.photo ? <Photo post={post} /> : <BeerImage uri={post.beer.imageThumbUrl} />}
        <View>
          <Text variant="subtitle">{post.beer.name}</Text>
          {post.beer.brand !== post.beer.name ? <Text muted>{post.beer.brand}</Text> : null}
          <Text muted>{formatServing(post.serving, post.volumeMl, t)}</Text>
        </View>
        {post.caption ? <Text>{post.caption}</Text> : null}
      </Pressable>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1 }}>{footer}</View>
        <Pressable accessibilityRole="button" onPress={open} hitSlop={8}>
          <Text muted>💬 {post.commentCount}</Text>
        </Pressable>
      </View>
    </Card>
  );
}

function Photo({ post }: { post: FeedPost }) {
  const { colors, radius } = useTheme();
  const url = usePhotoUrl(post.photo?.path ?? null);
  const photo = post.photo!;
  return (
    <View
      style={{
        aspectRatio: Math.max(photo.width / photo.height, 0.8),
        borderRadius: radius.md,
        overflow: 'hidden',
        backgroundColor: colors.surfaceAlt,
      }}
    >
      {url.data ? <Image source={url.data} contentFit="cover" style={{ flex: 1 }} /> : null}
    </View>
  );
}

function BeerImage({ uri }: { uri: string | null }) {
  const { colors, radius } = useTheme();
  return (
    <View
      testID="beer-image"
      style={{
        height: 160,
        borderRadius: radius.md,
        backgroundColor: colors.surfaceAlt,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {uri ? (
        <Image source={uri} contentFit="contain" style={{ width: 120, height: 140 }} />
      ) : (
        <Text>🍺</Text>
      )}
    </View>
  );
}
