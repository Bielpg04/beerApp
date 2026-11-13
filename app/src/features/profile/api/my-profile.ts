import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/shared/lib/supabase';

import type { MyProfile } from '../types';

export const myProfileKey = ['profile', 'me'] as const;

/** The signed-in user's own profile row (includes private fields), or null if there is none. */
async function fetchOwnProfile(): Promise<MyProfile | null> {
  const { data: auth } = await supabase.auth.getSession();
  const userId = auth.session?.user.id;
  if (!userId) return null;
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

/** Used by the root layout; disabled while signed out. */
export function useMyProfile(userId: string | null) {
  return useQuery({ queryKey: myProfileKey, queryFn: fetchOwnProfile, enabled: userId !== null });
}

/** For screens shown only to signed-in users. Shares the cache with useMyProfile. */
export function useOwnProfile() {
  return useQuery({ queryKey: myProfileKey, queryFn: fetchOwnProfile });
}
