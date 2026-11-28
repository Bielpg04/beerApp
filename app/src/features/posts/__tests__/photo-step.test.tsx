import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { i18n } from '@/shared/i18n';
import { supabase } from '@/shared/lib/supabase';

import { NewPostScreen, usePostDraft, type DraftPhoto } from '..';
import { photoFileExists, pickPhoto, PhotoPermissionError, uploadPhoto } from '../api/upload-photo';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock('@/shared/lib/supabase', () => ({ supabase: { rpc: jest.fn(), from: jest.fn() } }));
jest.mock('../api/upload-photo', () => {
  const actual = jest.requireActual('../api/upload-photo');
  return {
    ...actual,
    pickPhoto: jest.fn(),
    uploadPhoto: jest.fn(),
    removePhotos: jest.fn(),
    photoFileExists: jest.fn(),
  };
});

const t = (key: string, options?: object) => i18n.t(key as never, options as never) as unknown as string;
const beer = {
  id: 'b1',
  name: 'Estrella Damm',
  brand: 'Damm',
  imageThumbUrl: null,
  abv: null,
  styleCode: null,
};
const photo: DraftPhoto = {
  uri: 'file:///p.jpg',
  width: 3024,
  height: 4032,
  source: 'camera',
  exifTakenAt: null,
};
const rpc = supabase.rpc as jest.Mock;

async function renderAt(step: 'photo' | 'details', draftPhoto: DraftPhoto | null = null) {
  usePostDraft.setState({ beer, step, photo: draftPhoto });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  await render(
    <QueryClientProvider client={client}>
      <NewPostScreen userId="u1" />
    </QueryClientProvider>,
  );
}

beforeAll(() => i18n.changeLanguage('ca'));
beforeEach(() => {
  jest.clearAllMocks();
  usePostDraft.getState().reset();
  (photoFileExists as jest.Mock).mockResolvedValue(true);
});

it('takes a photo and shows it', async () => {
  (pickPhoto as jest.Mock).mockResolvedValue(photo);
  await renderAt('photo');
  await fireEvent.press(screen.getByRole('button', { name: t('posts.new.takePhoto') }));
  expect(pickPhoto).toHaveBeenCalledWith('camera');
  expect(await screen.findByLabelText(t('posts.new.photoPreview'))).toBeOnTheScreen();
  expect(usePostDraft.getState().photo).toEqual(photo);
  await fireEvent.press(screen.getByRole('button', { name: t('posts.new.continue') }));
  expect(usePostDraft.getState().step).toBe('details');
});

it('chooses from the library', async () => {
  (pickPhoto as jest.Mock).mockResolvedValue({ ...photo, source: 'library' });
  await renderAt('photo');
  await fireEvent.press(screen.getByRole('button', { name: t('posts.new.choosePhoto') }));
  expect(pickPhoto).toHaveBeenCalledWith('library');
  await waitFor(() => expect(usePostDraft.getState().photo?.source).toBe('library'));
});

it('keeps the current photo when picking is cancelled, and can remove it', async () => {
  (pickPhoto as jest.Mock).mockResolvedValue(null);
  await renderAt('photo', photo);
  await fireEvent.press(await screen.findByRole('button', { name: t('posts.new.takeAnother') }));
  expect(usePostDraft.getState().photo).toEqual(photo);
  await fireEvent.press(screen.getByRole('button', { name: t('posts.new.removePhoto') }));
  expect(usePostDraft.getState().photo).toBeNull();
});

it('explains a missing permission', async () => {
  (pickPhoto as jest.Mock).mockRejectedValue(new PhotoPermissionError('camera'));
  await renderAt('photo');
  await fireEvent.press(screen.getByRole('button', { name: t('posts.new.takePhoto') }));
  expect(await screen.findByText(t('posts.new.photoPermission'))).toBeOnTheScreen();
});

it('drops a restored photo whose file is gone and says so', async () => {
  (photoFileExists as jest.Mock).mockResolvedValue(false);
  await renderAt('details', photo);
  expect(await screen.findByText(t('posts.new.photoGone'))).toBeOnTheScreen();
  expect(usePostDraft.getState().photo).toBeNull();
});

it('uploads the photo when publishing', async () => {
  const uploaded = { path: 'u1/a.jpg', thumbPath: 'u1/a_thumb.jpg', width: 1080, height: 1440 };
  (uploadPhoto as jest.Mock).mockResolvedValue(uploaded);
  rpc.mockResolvedValue({ data: 'post-9', error: null });
  await renderAt('details', photo);
  await fireEvent.press(await screen.findByRole('radio', { name: t('posts.serving.bottle') }));
  await fireEvent.press(screen.getByRole('button', { name: t('posts.new.publish') }));
  await waitFor(() => expect(router.push).toHaveBeenCalledWith('/post/post-9'));
  expect(uploadPhoto).toHaveBeenCalledWith(photo, 'u1');
  expect(rpc).toHaveBeenCalledWith(
    'create_post',
    expect.objectContaining({ photo: { ...uploaded, source: 'camera', exifTakenAt: null } }),
  );
});
