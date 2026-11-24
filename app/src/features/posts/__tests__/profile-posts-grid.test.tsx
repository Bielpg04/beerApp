import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { i18n } from '@/shared/i18n';
import { supabase } from '@/shared/lib/supabase';

import { ProfilePostsGrid } from '..';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
const mockCreateSignedUrls = jest.fn();
jest.mock('@/shared/lib/supabase', () => ({
  supabase: { from: jest.fn(), storage: { from: () => ({ createSignedUrls: mockCreateSignedUrls }) } },
}));

const t = (key: string, options?: object) => i18n.t(key as never, options as never) as unknown as string;
let calls: { method: string; args: unknown[] }[] = [];
let pages: unknown[][] = [];

function row(n: number, photo = false) {
  const consumedAt = new Date(Date.UTC(2026, 10, 20) - n * 3_600_000).toISOString();
  return {
    id: `p${n}`,
    author_id: 'u1',
    serving: 'tap',
    volume_ml: null,
    caption: null,
    consumed_at: consumedAt,
    is_retroactive: false,
    publish_to_feed: true,
    verification_level: 'unverified',
    created_at: consumedAt,
    beer: { id: `beer-${n}`, name: `Beer ${n}`, brand: 'Brand', image_thumb_url: null },
    photo: photo ? { path: `u1/${n}.jpg`, thumb_path: `u1/${n}_thumb.jpg`, width: 1080, height: 1080 } : null,
  };
}

async function renderGrid(isMe = false) {
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'order', 'or']) {
    chain[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return chain;
    };
  }
  chain.limit = (...args: unknown[]) => {
    calls.push({ method: 'limit', args });
    return Promise.resolve({ data: pages.shift() ?? [], error: null });
  };
  (supabase.from as jest.Mock).mockReturnValue(chain);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  await render(
    <QueryClientProvider client={client}>
      <ProfilePostsGrid userId="u1" isMe={isMe} />
    </QueryClientProvider>,
  );
}

beforeAll(() => i18n.changeLanguage('ca'));
beforeEach(() => {
  jest.clearAllMocks();
  calls = [];
  pages = [];
  mockCreateSignedUrls.mockImplementation(async (paths: string[]) => ({
    data: paths.map((path) => ({ path, signedUrl: `https://signed/${path}`, error: null })),
    error: null,
  }));
});

it("loads the user's posts, newest drunk first, 30 at a time", async () => {
  pages = [[row(1)]];
  await renderGrid();
  await screen.findByText('Beer 1');
  expect(calls).toEqual(
    expect.arrayContaining([
      { method: 'eq', args: ['author_id', 'u1'] },
      { method: 'order', args: ['consumed_at', { ascending: false }] },
      { method: 'order', args: ['id', { ascending: false }] },
      { method: 'limit', args: [31] },
    ]),
  );
});

it('shows photos as signed thumbnails, signed in one request', async () => {
  pages = [[row(1, true), row(2, true), row(3)]];
  await renderGrid();
  await waitFor(() => expect(screen.getAllByTestId('post-thumb')).toHaveLength(2));
  expect(mockCreateSignedUrls).toHaveBeenCalledTimes(1);
  expect(mockCreateSignedUrls).toHaveBeenCalledWith(['u1/1_thumb.jpg', 'u1/2_thumb.jpg'], 3600);
  expect(screen.getByText('Beer 3')).toBeOnTheScreen(); // no photo → the beer's name
});

it('loads the next page from the last post shown', async () => {
  pages = [Array.from({ length: 31 }, (_, i) => row(i + 1)), [row(40)]];
  await renderGrid();
  expect(await screen.findByText('Beer 30')).toBeOnTheScreen();
  expect(screen.queryByText('Beer 31')).toBeNull(); // the 31st only says there are more
  await fireEvent.press(screen.getByRole('button', { name: t('posts.grid.more') }));
  expect(await screen.findByText('Beer 40')).toBeOnTheScreen();
  const last = row(30);
  expect(calls).toContainEqual({
    method: 'or',
    args: [`consumed_at.lt."${last.consumed_at}",and(consumed_at.eq."${last.consumed_at}",id.lt.p30)`],
  });
  expect(screen.queryByRole('button', { name: t('posts.grid.more') })).toBeNull();
});

it('does not offer more when the page is not full', async () => {
  pages = [[row(1), row(2)]];
  await renderGrid();
  await screen.findByText('Beer 2');
  expect(screen.queryByRole('button', { name: t('posts.grid.more') })).toBeNull();
});

it('opens a post', async () => {
  pages = [[row(7)]];
  await renderGrid();
  await fireEvent.press(await screen.findByText('Beer 7'));
  expect(router.push).toHaveBeenCalledWith('/post/p7');
});

it('invites me to log my first beer when I have none', async () => {
  await renderGrid(true);
  expect(await screen.findByText(t('posts.grid.emptyMine'))).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: t('posts.mine.logFirst') }));
  expect(router.push).toHaveBeenCalledWith('/new-post');
});

it("just says it is empty on someone else's profile", async () => {
  await renderGrid(false);
  expect(await screen.findByText(t('posts.grid.empty'))).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: t('posts.mine.logFirst') })).toBeNull();
});
