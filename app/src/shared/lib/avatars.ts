import { supabase } from './supabase';

/** Public bucket: avatars are shown to anyone who sees the user. */
export const AVATAR_BUCKET = 'avatars';

export function avatarUrl(path: string | null | undefined): string | null {
  return path ? supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl : null;
}
