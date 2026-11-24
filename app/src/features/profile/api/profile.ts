import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/shared/lib/supabase';

import type { PersonSummary, Profile, Relationship } from '../types';

/** Every query about a user starts with this, so invalidating ['profile'] refreshes them all. */
export const profileKey = (id: string) => ['profile', id] as const;

type ProfileRow = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_path: string | null;
  bio: string | null;
  is_private: boolean;
  relationship: string;
  can_see_posts: boolean;
  posts_count: number | null;
  beers_count: number | null;
  friends_count: number | null;
};

export function toProfile(row: ProfileRow): Profile {
  const counted = row.posts_count !== null && row.beers_count !== null && row.friends_count !== null;
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarPath: row.avatar_path,
    bio: row.bio,
    isPrivate: row.is_private,
    relationship: row.relationship as Relationship,
    canSeePosts: row.can_see_posts,
    stats: counted ? { posts: row.posts_count!, beers: row.beers_count!, friends: row.friends_count! } : null,
  };
}

/** Someone's profile as I may see it, or null if it doesn't exist for me. */
async function fetchProfile(id: string): Promise<Profile | null> {
  const { data, error } = await supabase.rpc('get_profile', { user_id: id });
  if (error) throw error;
  const row = (data as ProfileRow[] | null)?.[0];
  return row ? toProfile(row) : null;
}

export function useProfile(id: string) {
  return useQuery({ queryKey: profileKey(id), queryFn: () => fetchProfile(id) });
}

/** Name and avatar of any onboarded user (for authors and rows). */
export function usePersonSummary(id: string) {
  return useQuery({
    queryKey: [...profileKey(id), 'summary'],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PersonSummary | null> => {
      const { data, error } = await supabase
        .from('public_profiles')
        .select('id, username, display_name, avatar_path')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      if (!data?.id || !data.username) return null;
      return {
        id: data.id,
        username: data.username,
        displayName: data.display_name,
        avatarPath: data.avatar_path,
      };
    },
  });
}
