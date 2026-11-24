import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/shared/lib/supabase';

import type { Person } from '../types';
import { toPerson, type PersonRow } from './requests';

export const friendsKey = ['social', 'friends'] as const;

/** My friends, by name. */
export function useFriends() {
  return useQuery({
    queryKey: friendsKey,
    queryFn: async (): Promise<Person[]> => {
      const { data, error } = await supabase.rpc('my_friends');
      if (error) throw error;
      return ((data ?? []) as PersonRow[]).map(toPerson);
    },
  });
}
