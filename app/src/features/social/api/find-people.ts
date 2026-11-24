import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/shared/lib/supabase';

import type { Person, Relationship } from '../types';
import { toPerson, type PersonRow } from './requests';

export const FIND_MIN_CHARS = 2;

/** What the server searches for: no @, no spaces, lower case. */
export function normalizeQuery(q: string): string {
  return q.replace(/[@\s]/g, '').toLowerCase();
}

export type FoundPerson = Person & { relationship: Relationship };

/** People whose username starts with `q` (already debounced). Off below 2 characters. */
export function useFindPeople(q: string) {
  const term = normalizeQuery(q);
  return useQuery({
    queryKey: ['social', 'find', term],
    enabled: term.length >= FIND_MIN_CHARS,
    queryFn: async (): Promise<FoundPerson[]> => {
      const { data, error } = await supabase.rpc('find_people', { q: term });
      if (error) throw error;
      return ((data ?? []) as (PersonRow & { relationship: string })[]).map((row) => ({
        ...toPerson(row),
        relationship: row.relationship as Relationship,
      }));
    },
  });
}
