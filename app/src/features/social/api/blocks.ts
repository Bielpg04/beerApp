import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/shared/lib/supabase';

import type { Person } from '../types';
import { SocialError } from './friendships';
import { invalidateSocial } from './invalidate';
import { toPerson, type PersonRow } from './requests';

export const blockedUsersKey = ['social', 'blocked'] as const;

function useBlockMutation(fn: 'block_user' | 'unblock_user') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc(fn, { user_id: userId });
      if (error) throw new SocialError(error.message);
    },
    onSettled: () => invalidateSocial(queryClient),
  });
}

export function useBlockActions() {
  return { block: useBlockMutation('block_user'), unblock: useBlockMutation('unblock_user') };
}

/** The users I blocked, most recent first. */
export function useBlockedUsers() {
  return useQuery({
    queryKey: blockedUsersKey,
    queryFn: async (): Promise<Person[]> => {
      const { data, error } = await supabase.rpc('my_blocked_users');
      if (error) throw error;
      return ((data ?? []) as PersonRow[]).map(toPerson);
    },
  });
}
