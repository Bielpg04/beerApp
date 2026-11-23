import { supabase } from '@/shared/lib/supabase';

import { initialDraft, publishPost, type PostDraft } from '..';

jest.mock('@/shared/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));
const rpc = supabase.rpc as jest.Mock;

const beer = {
  id: 'b1',
  name: 'Estrella Damm',
  brand: 'Damm',
  imageThumbUrl: null,
  abv: null,
  styleCode: null,
};
const draft: PostDraft = { ...initialDraft, beer, serving: 'bottle', volumeMl: 330, caption: '  Al sol ' };
const photo = {
  uri: 'file:///p.jpg',
  width: 3024,
  height: 4032,
  source: 'camera' as const,
  exifTakenAt: null,
};
const uploaded = { path: 'u1/a.jpg', thumbPath: 'u1/a_thumb.jpg', width: 1080, height: 1440 };

beforeEach(() => jest.clearAllMocks());

it('creates a post without a photo', async () => {
  rpc.mockResolvedValue({ data: 'post-1', error: null });
  const upload = jest.fn();
  await expect(publishPost(draft, 'u1', { upload, remove: jest.fn() })).resolves.toBe('post-1');
  expect(upload).not.toHaveBeenCalled();
  expect(rpc).toHaveBeenCalledWith('create_post', {
    beer_id: 'b1',
    serving: 'bottle',
    volume_ml: 330,
    caption: 'Al sol',
    photo: null,
    consumed_at: undefined,
    publish_to_feed: undefined,
  });
});

it('sends when it was drunk and the feed choice when the user set them', async () => {
  rpc.mockResolvedValue({ data: 'post-3', error: null });
  await publishPost({ ...draft, consumedAt: '2026-11-20T20:15:00.000Z', publishToFeed: true }, 'u1', {
    upload: jest.fn(),
    remove: jest.fn(),
  });
  expect(rpc).toHaveBeenCalledWith(
    'create_post',
    expect.objectContaining({ consumed_at: '2026-11-20T20:15:00.000Z', publish_to_feed: true }),
  );
});

it('uploads the photo first and attaches it', async () => {
  rpc.mockResolvedValue({ data: 'post-2', error: null });
  const upload = jest.fn().mockResolvedValue(uploaded);
  await publishPost({ ...draft, photo }, 'u1', { upload, remove: jest.fn() });
  expect(upload).toHaveBeenCalledWith(photo, 'u1');
  expect(rpc).toHaveBeenCalledWith(
    'create_post',
    expect.objectContaining({
      photo: { ...uploaded, source: 'camera', exifTakenAt: null },
    }),
  );
});

it('removes the uploaded files when the post cannot be created', async () => {
  const failure = { message: 'beer_not_found' };
  rpc.mockResolvedValue({ data: null, error: failure });
  const upload = jest.fn().mockResolvedValue(uploaded);
  const remove = jest.fn().mockResolvedValue(undefined);
  await expect(publishPost({ ...draft, photo }, 'u1', { upload, remove })).rejects.toBe(failure);
  expect(remove).toHaveBeenCalledWith(['u1/a.jpg', 'u1/a_thumb.jpg']);
});

it('needs a beer and a serving', async () => {
  const deps = { upload: jest.fn(), remove: jest.fn() };
  await expect(publishPost({ ...draft, beer: null }, 'u1', deps)).rejects.toThrow('incomplete_draft');
  await expect(publishPost({ ...draft, serving: null }, 'u1', deps)).rejects.toThrow('incomplete_draft');
  expect(rpc).not.toHaveBeenCalled();
});
