import type { Serving, VerificationLevel } from '@/features/posts';

export const REACTIONS = ['cheers', 'fire', 'laugh', 'drool'] as const;
export type ReactionType = (typeof REACTIONS)[number];

export const REACTION_EMOJI: Record<ReactionType, string> = {
  cheers: '🍺',
  fire: '🔥',
  laugh: '😂',
  drool: '🤤',
};

export type Author = { id: string; username: string; displayName: string | null; avatarPath: string | null };

/** A post as the feed shows it (get_feed). */
export type FeedPost = {
  id: string;
  author: Author;
  beer: { id: string; name: string; brand: string; imageThumbUrl: string | null };
  serving: Serving;
  volumeMl: number | null;
  caption: string | null;
  consumedAt: string;
  createdAt: string;
  isRetroactive: boolean;
  verificationLevel: VerificationLevel;
  photo: { path: string; thumbPath: string; width: number; height: number } | null;
  reactionCounts: Partial<Record<ReactionType, number>>;
  reactionTotal: number;
  myReaction: ReactionType | null;
  commentCount: number;
};
