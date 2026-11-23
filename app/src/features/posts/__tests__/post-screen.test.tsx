import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Text } from 'react-native';

import { i18n } from '@/shared/i18n';

import { PostScreen, postKey, type Post } from '..';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
const mockCreateSignedUrl = jest.fn();
jest.mock('@/shared/lib/supabase', () => ({
  supabase: { from: jest.fn(), storage: { from: () => ({ createSignedUrl: mockCreateSignedUrl }) } },
}));

const t = (key: string, options?: object) => i18n.t(key as never, options as never) as unknown as string;

const post: Post = {
  id: 'p1',
  authorId: 'user-a',
  beer: { id: 'beer-1', name: 'Estrella Damm', brand: 'Damm', imageThumbUrl: null },
  serving: 'bottle',
  volumeMl: 330,
  caption: 'Al sol',
  consumedAt: '2026-11-20T20:15:00.000Z',
  isRetroactive: false,
  publishToFeed: true,
  verificationLevel: 'unverified',
  createdAt: '2026-11-20T20:15:00.000Z',
  photo: { path: 'user-a/x.jpg', thumbPath: 'user-a/x_thumb.jpg', width: 1080, height: 1440 },
};

async function renderWith(value: Post | null, renderActions?: (p: Post) => React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } },
  });
  client.setQueryData(postKey('p1'), value);
  await render(
    <QueryClientProvider client={client}>
      <PostScreen id="p1" renderActions={renderActions} />
    </QueryClientProvider>,
  );
}

beforeAll(() => i18n.changeLanguage('ca'));
beforeEach(() => {
  jest.clearAllMocks();
  mockCreateSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed/x.jpg' }, error: null });
});

it('shows the beer, how it was served, the caption and when', async () => {
  await renderWith(post);
  expect(screen.getByText('Estrella Damm')).toBeOnTheScreen();
  expect(screen.getByText('Damm')).toBeOnTheScreen();
  expect(screen.getByText('Ampolla · 330 ml')).toBeOnTheScreen();
  expect(screen.getByText('Al sol')).toBeOnTheScreen();
  const when = new Intl.DateTimeFormat('ca', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(post.consumedAt),
  );
  expect(screen.getByText(when)).toBeOnTheScreen();
  expect(screen.queryByText(t('posts.retroactive'))).toBeNull();
  expect(screen.queryByText(t('posts.notOnFeed'))).toBeNull();
});

it('loads the photo through a signed URL', async () => {
  await renderWith(post);
  expect(await screen.findByLabelText(t('posts.photoLabel', { name: 'Estrella Damm' }))).toBeOnTheScreen();
  expect(mockCreateSignedUrl).toHaveBeenCalledWith('user-a/x.jpg', 3600);
});

it('opens the beer when its name is pressed', async () => {
  await renderWith(post);
  fireEvent.press(screen.getByRole('link', { name: /Estrella Damm/ }));
  expect(router.push).toHaveBeenCalledWith('/beer/beer-1');
});

it('marks retroactive posts and posts that are not on the feed', async () => {
  await renderWith({
    ...post,
    isRetroactive: true,
    publishToFeed: false,
    photo: null,
    volumeMl: null,
    caption: null,
  });
  expect(screen.getByText(t('posts.retroactive'))).toBeOnTheScreen();
  expect(screen.getByText(t('posts.notOnFeed'))).toBeOnTheScreen();
  expect(screen.getByText('Ampolla')).toBeOnTheScreen();
  expect(screen.queryByLabelText(t('posts.photoLabel', { name: 'Estrella Damm' }))).toBeNull();
  expect(mockCreateSignedUrl).not.toHaveBeenCalled();
});

it('shows the actions the route gives it', async () => {
  await renderWith(post, (p) => <Text>actions for {p.id}</Text>);
  expect(screen.getByText('actions for p1')).toBeOnTheScreen();
});

it('says so when the post does not exist or is not visible', async () => {
  await renderWith(null);
  expect(screen.getByText(t('posts.notFound'))).toBeOnTheScreen();
});

it('offers a retry when loading fails', async () => {
  const { supabase } = jest.requireMock('@/shared/lib/supabase');
  const maybeSingle = jest
    .fn()
    .mockResolvedValueOnce({ data: null, error: new Error('offline') })
    .mockResolvedValueOnce({ data: null, error: null });
  supabase.from.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle }) }) });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  await render(
    <QueryClientProvider client={client}>
      <PostScreen id="p1" />
    </QueryClientProvider>,
  );
  fireEvent.press(await screen.findByRole('button', { name: t('common.retry') }));
  expect(await screen.findByText(t('posts.notFound'))).toBeOnTheScreen();
});

it('formats tap, bottle and can in every language', async () => {
  const { formatServing } = jest.requireActual('..');
  await i18n.changeLanguage('en');
  expect(formatServing('tap', 568, i18n.t)).toBe('Draught · 568 ml');
  expect(formatServing('can', null, i18n.t)).toBe('Can');
  await i18n.changeLanguage('ca');
});
