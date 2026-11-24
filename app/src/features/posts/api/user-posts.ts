import { useInfiniteQuery } from '@tanstack/react-query';

import { supabase } from '@/shared/lib/supabase';

import type { Post } from '../types';
import { POST_COLUMNS, toPost } from './post';

export const POSTS_PAGE_SIZE = 30;

export const userPostsKey = (userId: string) => ['posts', 'user', userId] as const;

type Cursor = { consumedAt: string; id: string };
type Page = { posts: Post[]; next: Cursor | null };

/** One page of the posts of a user that I may see (RLS decides), newest drunk first. */
async function fetchPage(userId: string, cursor: Cursor | null): Promise<Page> {
  let query = supabase.from('posts').select(POST_COLUMNS).eq('author_id', userId);
  if (cursor) {
    // Keyset pagination: strictly after the last post shown, ties broken by id.
    const at = `"${cursor.consumedAt}"`;
    query = query.or(`consumed_at.lt.${at},and(consumed_at.eq.${at},id.lt.${cursor.id})`);
  }
  const { data, error } = await query
    .order('consumed_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(POSTS_PAGE_SIZE + 1); // one extra says whether there is a next page
  if (error) throw error;

  const rows = (data ?? []).map((row) => toPost(row as Parameters<typeof toPost>[0]));
  const posts = rows.slice(0, POSTS_PAGE_SIZE);
  const last = posts.at(-1);
  return {
    posts,
    next: rows.length > POSTS_PAGE_SIZE && last ? { consumedAt: last.consumedAt, id: last.id } : null,
  };
}

export function useUserPosts(userId: string) {
  return useInfiniteQuery({
    queryKey: userPostsKey(userId),
    initialPageParam: null as Cursor | null,
    queryFn: ({ pageParam }) => fetchPage(userId, pageParam),
    getNextPageParam: (page) => page.next,
  });
}
