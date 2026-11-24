import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/shared/lib/supabase';

import type { Person } from '../types';

export const friendRequestsKey = ['social', 'requests'] as const;

export type PersonRow = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_path: string | null;
};

export function toPerson(row: PersonRow): Person {
  return { id: row.id, username: row.username, displayName: row.display_name, avatarPath: row.avatar_path };
}

/** Pending requests other people sent me, newest first. */
export function useFriendRequests() {
  return useQuery({
    queryKey: friendRequestsKey,
    queryFn: async (): Promise<Person[]> => {
      const { data, error } = await supabase.rpc('my_friend_requests');
      if (error) throw error;
      return ((data ?? []) as PersonRow[]).map(toPerson);
    },
  });
}
