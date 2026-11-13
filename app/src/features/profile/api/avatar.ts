import { randomUUID } from 'expo-crypto';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/shared/lib/supabase';

const BUCKET = 'avatars';
const SIZE = 512;
const QUALITY = 0.7;

export type AvatarSource = 'camera' | 'library';

export class AvatarPermissionError extends Error {
  constructor(readonly source: AvatarSource) {
    super(`permission_denied:${source}`);
    this.name = 'AvatarPermissionError';
  }
}

async function pick(source: AvatarSource): Promise<string | null> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new AvatarPermissionError(source);

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  return result.canceled ? null : (result.assets[0]?.uri ?? null);
}

async function compress(uri: string): Promise<string> {
  const image = await ImageManipulator.manipulate(uri).resize({ width: SIZE, height: SIZE }).renderAsync();
  const saved = await image.saveAsync({ compress: QUALITY, format: SaveFormat.JPEG });
  return saved.uri;
}

/**
 * Lets the user pick or take a square photo, uploads a 512×512 JPEG to avatars/<userId>/
 * and deletes the previous one. Returns the new storage path, or null if cancelled.
 */
export async function pickAndUploadAvatar(
  userId: string,
  source: AvatarSource,
  previousPath: string | null,
): Promise<string | null> {
  const picked = await pick(source);
  if (!picked) return null;

  const body = await (await fetch(await compress(picked))).arrayBuffer();
  const path = `${userId}/${randomUUID()}.jpg`;
  const bucket = supabase.storage.from(BUCKET);
  const { error } = await bucket.upload(path, body, { contentType: 'image/jpeg' });
  if (error) throw error;

  if (previousPath && previousPath !== path) await bucket.remove([previousPath]); // best effort
  return path;
}

export function avatarUrl(path: string | null | undefined): string | null {
  return path ? supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl : null;
}
