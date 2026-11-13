import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/shared/lib/supabase';

import type { MyProfile } from '../types';

export const myProfileKey = ['profile', 'me'] as const;

async function fetchMyProfile(userId: string): Promise<MyProfile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

/** The signed-in user's own profile (includes private fields). Disabled while signed out. */
export function useMyProfile(userId: string | null) {
  return useQuery({
    queryKey: myProfileKey,
    queryFn: () => fetchMyProfile(userId!),
    enabled: userId !== null,
  });
}
