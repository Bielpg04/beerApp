import type { Serving, VerificationLevel } from '@/features/posts';

import type { FeedPost, ReactionType } from '../types';

export type FeedPostRow = {
  id: string;
  author_id: string;
  author_username: string;
  author_display_name: string | null;
  author_avatar_path: string | null;
  beer_id: string;
  beer_name: string;
  beer_brand: string;
  beer_image_thumb_url: string | null;
  serving: string;
  volume_ml: number | null;
  caption: string | null;
  consumed_at: string;
  created_at: string;
  is_retroactive: boolean;
  verification_level: string;
  photo_path: string | null;
  photo_thumb_path: string | null;
  photo_width: number | null;
  photo_height: number | null;
  reaction_counts: unknown;
  my_reaction: string | null;
  comment_count: number;
};

export function toFeedPost(row: FeedPostRow): FeedPost {
  const counts = (row.reaction_counts ?? {}) as Partial<Record<ReactionType, number>>;
  return {
    id: row.id,
    author: {
      id: row.author_id,
      username: row.author_username,
      displayName: row.author_display_name,
      avatarPath: row.author_avatar_path,
    },
    beer: {
      id: row.beer_id,
      name: row.beer_name,
      brand: row.beer_brand,
      imageThumbUrl: row.beer_image_thumb_url,
    },
    serving: row.serving as Serving,
    volumeMl: row.volume_ml,
    caption: row.caption,
    consumedAt: row.consumed_at,
    createdAt: row.created_at,
    isRetroactive: row.is_retroactive,
    verificationLevel: row.verification_level as VerificationLevel,
    photo:
      row.photo_path && row.photo_thumb_path && row.photo_width && row.photo_height
        ? {
            path: row.photo_path,
            thumbPath: row.photo_thumb_path,
            width: row.photo_width,
            height: row.photo_height,
          }
        : null,
    reactionCounts: counts,
    reactionTotal: Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0),
    myReaction: (row.my_reaction as ReactionType | null) ?? null,
    commentCount: row.comment_count,
  };
}
