import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/shared/lib/supabase';

import type { Serving } from '../types';
import { postKey } from './post';

export type PostEdit = {
  serving: Serving;
  volumeMl: number | null;
  caption: string;
  consumedAt: string;
  publishToFeed: boolean;
};

/** Saves the fields a post's author may change (the server enforces which). */
export function useUpdatePost(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (edit: PostEdit) => {
      const { error } = await supabase.rpc('update_post', {
        post_id: id,
        serving: edit.serving,
        volume_ml: edit.volumeMl as number,
        caption: edit.caption.trim() as string,
        consumed_at: edit.consumedAt,
        publish_to_feed: edit.publishToFeed,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['posts'] }),
        queryClient.invalidateQueries({ queryKey: postKey(id) }),
      ]);
    },
  });
}
