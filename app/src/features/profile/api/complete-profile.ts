import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/shared/lib/supabase';

import { myProfileKey } from './my-profile';
import { OnboardingError } from './set-birthdate';

export interface CompleteProfileInput {
  userId: string;
  username: string;
  displayName: string;
  avatarPath: string | null;
}

/** Last onboarding step: saves the avatar (if any), then username and name, and opens the app. */
export function useCompleteProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, username, displayName, avatarPath }: CompleteProfileInput) => {
      if (avatarPath) {
        const { error } = await supabase
          .from('profiles')
          .update({ avatar_path: avatarPath })
          .eq('id', userId);
        if (error) throw new OnboardingError('unknown');
      }
      const { error } = await supabase.rpc('complete_profile', { username, display_name: displayName });
      if (error) throw new OnboardingError(error.code === 'P0001' ? error.message : 'unknown');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: myProfileKey }),
  });
}
