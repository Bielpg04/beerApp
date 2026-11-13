import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/shared/lib/supabase';

import type { MyProfile } from '../types';
import { myProfileKey } from './my-profile';

export type UpdateProfileInput = Pick<MyProfile, 'display_name' | 'bio' | 'avatar_path' | 'is_private'>;

/** Saves the fields a user may edit after onboarding (enforced by column grants on the server). */
export function useUpdateProfile(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateProfileInput) => {
      const { display_name, bio, avatar_path, is_private } = input;
      const { error } = await supabase
        .from('profiles')
        .update({ display_name, bio, avatar_path, is_private })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: myProfileKey }),
  });
}
