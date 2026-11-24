import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';

import { supabase } from '@/shared/lib/supabase';

import type { Post } from '../types';
import { postKey } from './post';
import { removePhotos } from './upload-photo';

/**
 * Storage files cannot be deleted from SQL, so the app removes them first and then the row.
 * If the files fail, nothing changes; if the row fails, trying again finishes the job
 * (removing files that are already gone is not an error).
 */
export async function deletePost(post: Pick<Post, 'id' | 'photo'>): Promise<void> {
  if (post.photo) await removePhotos([post.photo.path, post.photo.thumbPath]);
  const { data, error } = await supabase.from('posts').delete().eq('id', post.id).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('post_not_found');
}

export function useDeletePost(post: Pick<Post, 'id' | 'photo'>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => deletePost(post),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: postKey(post.id) });
      void queryClient.invalidateQueries({ queryKey: ['posts'] });
      void queryClient.invalidateQueries({ queryKey: ['profile'] }); // counts on profiles
      router.back();
    },
  });
}
