import { supabase } from '@/shared/lib/supabase';

import type { DraftPhoto, PostDraft } from '../lib/draft';
import type { PostPhoto } from '../types';

/** How publishPost reaches Storage (injected so the flow can be tested without files). */
export type PhotoStorage = {
  upload: (photo: DraftPhoto, userId: string) => Promise<PostPhoto>;
  remove: (paths: string[]) => Promise<void>;
};

/**
 * Uploads the photo (if any), then creates the post on the server. If the post cannot be
 * created, the uploaded files are removed so nothing is left orphaned. Returns the post id.
 */
export async function publishPost(draft: PostDraft, userId: string, storage: PhotoStorage): Promise<string> {
  if (!draft.beer || !draft.serving) throw new Error('incomplete_draft');

  const uploaded = draft.photo ? await storage.upload(draft.photo, userId) : null;
  const { data, error } = await supabase.rpc('create_post', {
    beer_id: draft.beer.id,
    serving: draft.serving,
    volume_ml: draft.volumeMl ?? undefined,
    caption: draft.caption.trim() || undefined,
    photo:
      uploaded && draft.photo
        ? { ...uploaded, source: draft.photo.source, exifTakenAt: draft.photo.exifTakenAt }
        : null,
  });
  if (error || !data) {
    if (uploaded) await storage.remove([uploaded.path, uploaded.thumbPath]).catch(() => undefined);
    throw error ?? new Error('create_post_failed');
  }
  return data;
}
