import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/shared/lib/supabase';

import { PHOTO_BUCKET } from './photos';

const URL_TTL_SECONDS = 3600;

/** Signed URLs (1 h) for many private photos in one request; reused for 50 min. */
export function useThumbUrls(paths: string[]) {
  return useQuery({
    queryKey: ['photo-urls', ...paths],
    enabled: paths.length > 0,
    staleTime: 50 * 60_000,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase.storage
        .from(PHOTO_BUCKET)
        .createSignedUrls(paths, URL_TTL_SECONDS);
      if (error) throw error;
      const urls: Record<string, string> = {};
      for (const item of data ?? []) {
        if (item.path && item.signedUrl) urls[item.path] = item.signedUrl;
      }
      return urls;
    },
  });
}
