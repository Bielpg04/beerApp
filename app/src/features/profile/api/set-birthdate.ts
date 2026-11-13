import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/shared/lib/supabase';

import { toIsoDate } from '../lib/age';
import { myProfileKey } from './my-profile';

/** Error raised by an onboarding RPC; `reason` is the server's message (e.g. "underage"). */
export class OnboardingError extends Error {
  constructor(readonly reason: string) {
    super(reason);
    this.name = 'OnboardingError';
  }
}

export function useSetBirthdate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ birthdate, country }: { birthdate: Date; country: string }) => {
      const { error } = await supabase.rpc('set_birthdate', { birthdate: toIsoDate(birthdate), country });
      if (error) throw new OnboardingError(error.code === 'P0001' ? error.message : 'unknown');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: myProfileKey }),
  });
}
