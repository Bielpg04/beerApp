import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/shared/lib/supabase';

export const PHOTO_BUCKET = 'post-photos';
const URL_TTL_SECONDS = 3600;

/** Signed URL (1 h) for a private post photo; reused for 50 min. */
export function usePhotoUrl(path: string | null) {
  return useQuery({
    queryKey: ['photo-url', path],
    enabled: path !== null,
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from(PHOTO_BUCKET)
        .createSignedUrl(path as string, URL_TTL_SECONDS);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}
