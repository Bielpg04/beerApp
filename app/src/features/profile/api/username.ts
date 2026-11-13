import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { supabase } from '@/shared/lib/supabase';

import { isValidUsername } from '../lib/validation';

export const USERNAME_CHECK_DELAY_MS = 400;

export type UsernameStatus = 'empty' | 'invalid' | 'checking' | 'available' | 'taken';

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/** Live availability of a (normalized) username, asked to the server 400 ms after typing stops. */
export function useUsernameStatus(username: string): UsernameStatus {
  const debounced = useDebounced(username, USERNAME_CHECK_DELAY_MS);
  const valid = isValidUsername(username);
  const query = useQuery({
    queryKey: ['username-available', debounced],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('username_available', { candidate: debounced });
      if (error) throw error;
      return data;
    },
    enabled: valid && debounced === username,
    staleTime: 10_000,
  });

  if (username === '') return 'empty';
  if (!valid) return 'invalid';
  if (debounced !== username || query.isPending) return 'checking';
  return query.data ? 'available' : 'taken';
}
