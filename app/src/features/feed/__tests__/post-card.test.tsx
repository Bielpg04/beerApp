import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { i18n } from '@/shared/i18n';

import { PostCard, relativeTime, toFeedPost, type FeedPostRow } from '..';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
const mockCreateSignedUrl = jest.fn();
jest.mock('@/shared/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    storage: {
      from: () => ({
        createSignedUrl: mockCreateSignedUrl,
        getPublicUrl: (p: string) => ({ data: { publicUrl: `https://cdn/${p}` } }),
      }),
    },
  },
}));

const t = (key: string, options?: object) => i18n.t(key as never, options as never) as unknown as string;

const row: FeedPostRow = {
  id: 'p1',
  author_id: 'user-b',
  author_username: 'bea',
  author_display_name: 'Bea',
  author_avatar_path: null,
  beer_id: 'beer-1',
  beer_name: 'Moritz',
  beer_brand: 'Moritz',
  beer_image_thumb_url: 'https://img/moritz.jpg',
  serving: 'tap',
  volume_ml: 500,
  caption: 'Al sol',
  consumed_at: '2026-11-28T10:00:00Z',
  created_at: '2026-11-28T10:00:00Z',
  is_retroactive: false,
  verification_level: 'unverified',
  photo_path: 'user-b/p.jpg',
  photo_thumb_path: 'user-b/p_thumb.jpg',
  photo_width: 1080,
  photo_height: 1350,
  reaction_counts: { cheers: 2, fire: 1 },
  my_reaction: null,
  comment_count: 3,
};

async function renderCard(overrides: Partial<FeedPostRow> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  await render(
    <QueryClientProvider client={client}>
      <PostCard post={toFeedPost({ ...row, ...overrides })} now={new Date('2026-11-28T12:00:00Z')} />
    </QueryClientProvider>,
  );
}

beforeAll(() => i18n.changeLanguage('ca'));
beforeEach(() => {
  jest.clearAllMocks();
  mockCreateSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed/p.jpg' }, error: null });
});

it('shows the author, the beer, how it was served, the caption and when', async () => {
  await renderCard();
  expect(screen.getByText('Bea')).toBeOnTheScreen();
  expect(screen.getByText('Moritz')).toBeOnTheScreen();
  expect(screen.getByText(`${t('posts.serving.tap')} · 500 ml`)).toBeOnTheScreen();
  expect(screen.getByText('Al sol')).toBeOnTheScreen();
  expect(screen.getByText(t('feed.time.hours', { count: 2 }))).toBeOnTheScreen();
  expect(screen.getByText('💬 3')).toBeOnTheScreen();
});

it('loads the photo through a signed URL', async () => {
  await renderCard();
  await waitFor(() => expect(mockCreateSignedUrl).toHaveBeenCalledWith('user-b/p.jpg', 3600));
});

it('opens the post, and the author from their name', async () => {
  await renderCard();
  await fireEvent.press(screen.getByText('Al sol'));
  expect(router.push).toHaveBeenCalledWith('/post/p1');
  await fireEvent.press(screen.getByText('Bea'));
  expect(router.push).toHaveBeenCalledWith('/user/user-b');
});

it('shows the beer image when there is no photo', async () => {
  await renderCard({ photo_path: null, photo_thumb_path: null, photo_width: null, photo_height: null });
  expect(mockCreateSignedUrl).not.toHaveBeenCalled();
  expect(screen.getByTestId('beer-image')).toBeOnTheScreen();
});

it('counts the reactions', () => {
  expect(toFeedPost(row).reactionTotal).toBe(3);
});

describe('relativeTime', () => {
  const now = new Date('2026-11-28T12:00:00Z');
  const tt = (key: string, options?: object) => `${key}:${JSON.stringify(options ?? {})}`;
  it.each([
    ['2026-11-28T11:59:40Z', 'feed.time.now:{}'],
    ['2026-11-28T11:15:00Z', 'feed.time.minutes:{"count":45}'],
    ['2026-11-28T02:00:00Z', 'feed.time.hours:{"count":10}'],
    ['2026-11-25T12:00:00Z', 'feed.time.days:{"count":3}'],
  ])('%s → %s', (iso, expected) => {
    expect(relativeTime(iso, now, tt as never, 'ca')).toBe(expected);
  });
  it('uses the date after a week', () => {
    expect(relativeTime('2026-11-01T12:00:00Z', now, tt as never, 'ca')).toMatch(/2026|nov/);
  });
});
