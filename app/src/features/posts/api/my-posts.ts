import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/shared/lib/supabase';

import type { Post } from '../types';
import { POST_COLUMNS, toPost } from './post';

export const myPostsKey = ['posts', 'mine'] as const;

/** My latest posts by when they were drunk (published to the feed or not). */
export function useMyRecentPosts(userId: string, limit = 20) {
  return useQuery({
    queryKey: [...myPostsKey, 'recent', limit],
    queryFn: async (): Promise<Post[]> => {
      const { data, error } = await supabase
        .from('posts')
        .select(POST_COLUMNS)
        .eq('author_id', userId)
        .order('consumed_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []).map((row) => toPost(row as Parameters<typeof toPost>[0]));
    },
  });
}
