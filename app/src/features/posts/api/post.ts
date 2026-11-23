import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/shared/lib/supabase';

import type { Post, Serving, VerificationLevel } from '../types';

export const postKey = (id: string) => ['post', id] as const;

export const POST_COLUMNS =
  'id, author_id, serving, volume_ml, caption, consumed_at, is_retroactive, publish_to_feed, verification_level, created_at, beer:beers(id, name, brand, image_thumb_url), photo:post_photos(path, thumb_path, width, height)';

type PostRow = {
  id: string;
  author_id: string;
  serving: string;
  volume_ml: number | null;
  caption: string | null;
  consumed_at: string;
  is_retroactive: boolean;
  publish_to_feed: boolean;
  verification_level: string;
  created_at: string;
  beer: { id: string; name: string; brand: string; image_thumb_url: string | null };
  photo: { path: string; thumb_path: string; width: number; height: number } | null;
};

export function toPost(row: PostRow): Post {
  return {
    id: row.id,
    authorId: row.author_id,
    beer: {
      id: row.beer.id,
      name: row.beer.name,
      brand: row.beer.brand,
      imageThumbUrl: row.beer.image_thumb_url,
    },
    serving: row.serving as Serving,
    volumeMl: row.volume_ml,
    caption: row.caption,
    consumedAt: row.consumed_at,
    isRetroactive: row.is_retroactive,
    publishToFeed: row.publish_to_feed,
    verificationLevel: row.verification_level as VerificationLevel,
    createdAt: row.created_at,
    photo: row.photo
      ? {
          path: row.photo.path,
          thumbPath: row.photo.thumb_path,
          width: row.photo.width,
          height: row.photo.height,
        }
      : null,
  };
}

/** A post the user may see (RLS decides), or null. */
async function fetchPost(id: string): Promise<Post | null> {
  const { data, error } = await supabase.from('posts').select(POST_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? toPost(data as PostRow) : null;
}

export function usePost(id: string) {
  return useQuery({ queryKey: postKey(id), queryFn: () => fetchPost(id) });
}
