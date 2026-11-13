import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator } from 'expo-image-manipulator';

import { supabase } from '@/shared/lib/supabase';

import { AvatarPermissionError, avatarUrl, pickAndUploadAvatar } from '..';

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
}));
const render = { saveAsync: jest.fn() };
const context = { resize: jest.fn(), renderAsync: jest.fn() };
jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: jest.fn() },
  SaveFormat: { JPEG: 'jpeg' },
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'uuid-1' }));

const bucket = { upload: jest.fn(), remove: jest.fn(), getPublicUrl: jest.fn() };
jest.mock('@/shared/lib/supabase', () => ({ supabase: { storage: { from: jest.fn() } } }));

const picker = ImagePicker as jest.Mocked<typeof ImagePicker>;

beforeEach(() => {
  jest.clearAllMocks();
  (supabase.storage.from as jest.Mock).mockReturnValue(bucket);
  (ImageManipulator.manipulate as jest.Mock).mockReturnValue(context);
  context.resize.mockReturnValue(context);
  context.renderAsync.mockResolvedValue(render);
  render.saveAsync.mockResolvedValue({ uri: 'file:///small.jpg' });
  picker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true } as never);
  picker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true } as never);
  picker.launchImageLibraryAsync.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///big.jpg' }],
  } as never);
  bucket.upload.mockResolvedValue({ data: { path: 'user-1/uuid-1.jpg' }, error: null });
  bucket.remove.mockResolvedValue({ data: [], error: null });
  globalThis.fetch = jest.fn().mockResolvedValue({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });
});

it('compresses the picked image to a 512×512 JPEG and uploads it to the user folder', async () => {
  const path = await pickAndUploadAvatar('user-1', 'library', null);

  expect(picker.launchImageLibraryAsync).toHaveBeenCalledWith(
    expect.objectContaining({ allowsEditing: true, aspect: [1, 1] }),
  );
  expect(ImageManipulator.manipulate).toHaveBeenCalledWith('file:///big.jpg');
  expect(context.resize).toHaveBeenCalledWith({ width: 512, height: 512 });
  expect(render.saveAsync).toHaveBeenCalledWith({ compress: 0.7, format: 'jpeg' });
  expect(supabase.storage.from).toHaveBeenCalledWith('avatars');
  expect(bucket.upload).toHaveBeenCalledWith('user-1/uuid-1.jpg', expect.any(ArrayBuffer), {
    contentType: 'image/jpeg',
  });
  expect(path).toBe('user-1/uuid-1.jpg');
});

it('removes the previous avatar after uploading the new one', async () => {
  await pickAndUploadAvatar('user-1', 'library', 'user-1/old.jpg');
  expect(bucket.remove).toHaveBeenCalledWith(['user-1/old.jpg']);
});

it('returns null and uploads nothing when the user cancels', async () => {
  picker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null } as never);
  expect(await pickAndUploadAvatar('user-1', 'library', null)).toBeNull();
  expect(bucket.upload).not.toHaveBeenCalled();
});

it('uses the camera when asked and fails clearly without permission', async () => {
  picker.requestCameraPermissionsAsync.mockResolvedValue({ granted: false } as never);
  await expect(pickAndUploadAvatar('user-1', 'camera', null)).rejects.toBeInstanceOf(AvatarPermissionError);
  expect(picker.launchCameraAsync).not.toHaveBeenCalled();
});

it('builds the public URL of an avatar path', () => {
  bucket.getPublicUrl.mockReturnValue({ data: { publicUrl: 'https://x/avatars/user-1/a.jpg' } });
  expect(avatarUrl('user-1/a.jpg')).toBe('https://x/avatars/user-1/a.jpg');
  expect(avatarUrl(null)).toBeNull();
});
