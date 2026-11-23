import { randomUUID } from 'expo-crypto';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { supabase } from '@/shared/lib/supabase';

import type { DraftPhoto } from '../lib/draft';
import { fitLongestSide, PHOTO_MAX_SIDE, PHOTO_QUALITY, THUMB_MAX_SIDE, THUMB_QUALITY } from '../lib/photo';
import type { PostPhoto } from '../types';
import { PHOTO_BUCKET } from './photos';

export type PhotoSource = DraftPhoto['source'];

export class PhotoPermissionError extends Error {
  constructor(readonly source: PhotoSource) {
    super(`permission_denied:${source}`);
    this.name = 'PhotoPermissionError';
  }
}

/** Takes or picks a photo. EXIF is only read from the library (it suggests when the beer was drunk). */
export async function pickPhoto(source: PhotoSource): Promise<DraftPhoto | null> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new PhotoPermissionError(source);

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 1,
    exif: source === 'library',
  };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;
  return { uri: asset.uri, width: asset.width, height: asset.height, source, exifTakenAt: null };
}

/** Re-encodes to JPEG, which also drops the original metadata (GPS included). */
async function encode(photo: DraftPhoto, maxSide: number, quality: number) {
  let context = ImageManipulator.manipulate(photo.uri);
  const resize = fitLongestSide(photo.width, photo.height, maxSide);
  if (resize) context = context.resize(resize);
  const image = await context.renderAsync();
  return image.saveAsync({ compress: quality, format: SaveFormat.JPEG });
}

async function put(path: string, uri: string) {
  const body = await (await fetch(uri)).arrayBuffer();
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, body, { contentType: 'image/jpeg' });
  if (error) throw error;
}

/** Uploads a 1080 px photo and a 320 px thumbnail to post-photos/<userId>/. */
export async function uploadPhoto(photo: DraftPhoto, userId: string): Promise<PostPhoto> {
  const main = await encode(photo, PHOTO_MAX_SIDE, PHOTO_QUALITY);
  const thumb = await encode(photo, THUMB_MAX_SIDE, THUMB_QUALITY);
  const id = randomUUID();
  const path = `${userId}/${id}.jpg`;
  const thumbPath = `${userId}/${id}_thumb.jpg`;

  await put(path, main.uri);
  try {
    await put(thumbPath, thumb.uri);
  } catch (error) {
    await removePhotos([path]).catch(() => undefined);
    throw error;
  }
  return { path, thumbPath, width: main.width, height: main.height };
}

export async function removePhotos(paths: string[]): Promise<void> {
  const { error } = await supabase.storage.from(PHOTO_BUCKET).remove(paths);
  if (error) throw error;
}

/** A restored draft may point to a cached file the system already deleted. */
export async function photoFileExists(uri: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    try {
      return (await fetch(uri)).ok;
    } catch {
      return false;
    }
  }
  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
}
