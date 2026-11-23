import { ImageManipulator } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/shared/lib/supabase';

import {
  PhotoPermissionError,
  photoFileExists,
  pickPhoto,
  removePhotos,
  uploadPhoto,
  type DraftPhoto,
} from '..';

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
}));
const mockContext = { resize: jest.fn(), renderAsync: jest.fn() };
const mockRendered = { saveAsync: jest.fn() };
jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: jest.fn() },
  SaveFormat: { JPEG: 'jpeg' },
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'uuid-1' }));
const mockExisting = new Set<string>();
jest.mock('expo-file-system', () => ({
  File: class {
    mockUri: string;
    constructor(mockUri: string) {
      this.mockUri = mockUri;
    }
    get exists() {
      return mockExisting.has(this.mockUri);
    }
  },
}));
const mockBucket = { upload: jest.fn(), remove: jest.fn() };
jest.mock('@/shared/lib/supabase', () => ({ supabase: { storage: { from: jest.fn() } } }));

const picker = ImagePicker as jest.Mocked<typeof ImagePicker>;
const landscape: DraftPhoto = {
  uri: 'file:///big.jpg',
  width: 4032,
  height: 3024,
  source: 'camera',
  exifTakenAt: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  (supabase.storage.from as jest.Mock).mockReturnValue(mockBucket);
  (ImageManipulator.manipulate as jest.Mock).mockReturnValue(mockContext);
  mockContext.resize.mockReturnValue(mockContext);
  mockContext.renderAsync.mockResolvedValue(mockRendered);
  mockRendered.saveAsync
    .mockResolvedValueOnce({ uri: 'file:///main.jpg', width: 1080, height: 810 })
    .mockResolvedValueOnce({ uri: 'file:///thumb.jpg', width: 320, height: 240 });
  mockBucket.upload.mockResolvedValue({ data: {}, error: null });
  mockBucket.remove.mockResolvedValue({ data: [], error: null });
  picker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true } as never);
  picker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true } as never);
  globalThis.fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });
});

it('makes a 1080 px photo and a 320 px thumbnail of a landscape picture and uploads both', async () => {
  await expect(uploadPhoto(landscape, 'user-1')).resolves.toEqual({
    path: 'user-1/uuid-1.jpg',
    thumbPath: 'user-1/uuid-1_thumb.jpg',
    width: 1080,
    height: 810,
  });
  expect(mockContext.resize).toHaveBeenNthCalledWith(1, { width: 1080 });
  expect(mockContext.resize).toHaveBeenNthCalledWith(2, { width: 320 });
  expect(mockRendered.saveAsync).toHaveBeenNthCalledWith(1, { compress: 0.7, format: 'jpeg' });
  expect(mockRendered.saveAsync).toHaveBeenNthCalledWith(2, { compress: 0.6, format: 'jpeg' });
  expect(supabase.storage.from).toHaveBeenCalledWith('post-photos');
  expect(mockBucket.upload).toHaveBeenNthCalledWith(1, 'user-1/uuid-1.jpg', expect.any(ArrayBuffer), {
    contentType: 'image/jpeg',
  });
  expect(mockBucket.upload).toHaveBeenNthCalledWith(2, 'user-1/uuid-1_thumb.jpg', expect.any(ArrayBuffer), {
    contentType: 'image/jpeg',
  });
});

it('limits the height of a portrait picture', async () => {
  await uploadPhoto({ ...landscape, width: 3024, height: 4032 }, 'user-1');
  expect(mockContext.resize).toHaveBeenNthCalledWith(1, { height: 1080 });
  expect(mockContext.resize).toHaveBeenNthCalledWith(2, { height: 320 });
});

it('never enlarges a small picture but still re-encodes it (dropping its metadata)', async () => {
  await uploadPhoto({ ...landscape, width: 800, height: 600 }, 'user-1');
  expect(mockContext.resize).toHaveBeenCalledTimes(1);
  expect(mockContext.resize).toHaveBeenCalledWith({ width: 320 });
  expect(mockRendered.saveAsync).toHaveBeenCalledTimes(2);
});

it('removes the photo when the thumbnail cannot be uploaded', async () => {
  mockBucket.upload
    .mockResolvedValueOnce({ data: {}, error: null })
    .mockResolvedValueOnce({ data: null, error: new Error('offline') });
  await expect(uploadPhoto(landscape, 'user-1')).rejects.toThrow('offline');
  expect(mockBucket.remove).toHaveBeenCalledWith(['user-1/uuid-1.jpg']);
});

it('removes files', async () => {
  await removePhotos(['a', 'b']);
  expect(mockBucket.remove).toHaveBeenCalledWith(['a', 'b']);
});

it('takes a photo with the camera without asking for EXIF', async () => {
  picker.launchCameraAsync.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///c.jpg', width: 3024, height: 4032 }],
  } as never);
  await expect(pickPhoto('camera')).resolves.toEqual({
    uri: 'file:///c.jpg',
    width: 3024,
    height: 4032,
    source: 'camera',
    exifTakenAt: null,
  });
  expect(picker.launchCameraAsync).toHaveBeenCalledWith(expect.objectContaining({ exif: false }));
});

it('picks from the library and returns null when cancelled', async () => {
  picker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null } as never);
  await expect(pickPhoto('library')).resolves.toBeNull();
  expect(picker.launchImageLibraryAsync).toHaveBeenCalledWith(expect.objectContaining({ exif: true }));
});

it('fails clearly without permission', async () => {
  picker.requestCameraPermissionsAsync.mockResolvedValue({ granted: false } as never);
  await expect(pickPhoto('camera')).rejects.toBeInstanceOf(PhotoPermissionError);
  expect(picker.launchCameraAsync).not.toHaveBeenCalled();
});

it('tells whether a local photo still exists', async () => {
  mockExisting.add('file:///p.jpg');
  await expect(photoFileExists('file:///p.jpg')).resolves.toBe(true);
  await expect(photoFileExists('file:///gone.jpg')).resolves.toBe(false);
  expect(globalThis.fetch).not.toHaveBeenCalled();
});
