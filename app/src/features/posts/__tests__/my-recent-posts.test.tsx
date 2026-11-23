import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { i18n } from '@/shared/i18n';
import { supabase } from '@/shared/lib/supabase';

import { MyRecentPosts } from '..';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
const mockCreateSignedUrl = jest.fn();
jest.mock('@/shared/lib/supabase', () => ({
  supabase: { from: jest.fn(), storage: { from: () => ({ createSignedUrl: mockCreateSignedUrl }) } },
}));

const t = (key: string, options?: object) => i18n.t(key as never, options as never) as unknown as string;
const calls: { method: string; args: unknown[] }[] = [];
let rows: unknown[] = [];

function row(id: string, beer: string, consumedAt: string, photo: object | null = null) {
  return {
    id,
    author_id: 'u1',
    serving: 'tap',
    volume_ml: null,
    caption: null,
    consumed_at: consumedAt,
    is_retroactive: false,
    publish_to_feed: true,
    verification_level: 'unverified',
    created_at: consumedAt,
    beer: { id: `beer-${id}`, name: beer, brand: 'Brand', image_thumb_url: null },
    photo,
  };
}

async function renderList() {
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'order']) {
    chain[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return chain;
    };
  }
  chain.limit = (...args: unknown[]) => {
    calls.push({ method: 'limit', args });
    return Promise.resolve({ data: rows, error: null });
  };
  (supabase.from as jest.Mock).mockReturnValue(chain);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  await render(
    <QueryClientProvider client={client}>
      <MyRecentPosts userId="u1" />
    </QueryClientProvider>,
  );
}

beforeAll(() => i18n.changeLanguage('ca'));
beforeEach(() => {
  jest.clearAllMocks();
  calls.length = 0;
  mockCreateSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed/t.jpg' }, error: null });
});

it('lists my latest posts, newest drunk first, and opens one', async () => {
  rows = [
    row('p2', 'Moritz', '2026-11-22T20:00:00Z', {
      path: 'u1/a.jpg',
      thumb_path: 'u1/a_thumb.jpg',
      width: 1080,
      height: 810,
    }),
    row('p1', 'Estrella Damm', '2026-11-20T20:00:00Z'),
  ];
  await renderList();
  expect(screen.getByText(t('posts.mine.title'))).toBeOnTheScreen();
  const items = await screen.findAllByRole('button', { name: /Moritz|Estrella Damm/ });
  expect(items.map((i) => i.props.accessibilityLabel)).toEqual([
    expect.stringContaining('Moritz'),
    expect.stringContaining('Estrella Damm'),
  ]);
  expect(calls).toEqual(
    expect.arrayContaining([
      { method: 'eq', args: ['author_id', 'u1'] },
      { method: 'order', args: ['consumed_at', { ascending: false }] },
      { method: 'limit', args: [20] },
    ]),
  );
  await waitFor(() => expect(mockCreateSignedUrl).toHaveBeenCalledWith('u1/a_thumb.jpg', 3600));
  await fireEvent.press(items[1]!);
  expect(router.push).toHaveBeenCalledWith('/post/p1');
});

it('invites to log a first beer when there are none', async () => {
  rows = [];
  await renderList();
  expect(await screen.findByText(t('posts.mine.empty'))).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: t('posts.mine.logFirst') }));
  expect(router.push).toHaveBeenCalledWith('/new-post');
});
