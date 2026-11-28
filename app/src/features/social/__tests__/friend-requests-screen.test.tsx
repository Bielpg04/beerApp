import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { i18n } from '@/shared/i18n';
import { supabase } from '@/shared/lib/supabase';

import { FriendRequestsLink, FriendRequestsScreen } from '..';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/shared/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    storage: { from: () => ({ getPublicUrl: (p: string) => ({ data: { publicUrl: `https://cdn/${p}` } }) }) },
  },
}));

const t = (key: string, options?: object) => i18n.t(key as never, options as never) as unknown as string;
const rpc = supabase.rpc as jest.Mock;
const bea = {
  id: 'user-b',
  username: 'bea',
  display_name: 'Bea',
  avatar_path: null,
  requested_at: '2026-11-24T10:00:00Z',
};
const carles = { ...bea, id: 'user-c', username: 'carles', display_name: null };
let requests: (typeof bea | typeof carles)[] = [];
const results: Record<string, { data: unknown; error: unknown }> = {};

async function renderUi(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  await render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeAll(() => i18n.changeLanguage('ca'));
beforeEach(() => {
  jest.clearAllMocks();
  requests = [bea, carles];
  for (const key of Object.keys(results)) delete results[key];
  rpc.mockImplementation(async (fn: string, args?: { user_id: string }) => {
    if (fn === 'my_friend_requests') return { data: requests, error: null };
    if (results[fn]) return results[fn];
    requests = requests.filter((r) => r.id !== args?.user_id);
    return { data: null, error: null };
  });
});

it('lists the requests I received', async () => {
  await renderUi(<FriendRequestsScreen />);
  expect(await screen.findByText('Bea')).toBeOnTheScreen();
  expect(screen.getByText('@bea')).toBeOnTheScreen();
  expect(screen.getByText('carles')).toBeOnTheScreen(); // no display name → username
});

it('accepts a request and drops it from the list', async () => {
  await renderUi(<FriendRequestsScreen />);
  await screen.findByText('Bea');
  await fireEvent.press(screen.getAllByRole('button', { name: t('social.friendship.accept') })[0]!);
  expect(rpc).toHaveBeenCalledWith('accept_friend_request', { user_id: 'user-b' });
  await waitFor(() => expect(screen.queryByText('Bea')).toBeNull());
});

it('declines a request', async () => {
  await renderUi(<FriendRequestsScreen />);
  await screen.findByText('Bea');
  await fireEvent.press(screen.getAllByRole('button', { name: t('social.friendship.decline') })[1]!);
  expect(rpc).toHaveBeenCalledWith('decline_friend_request', { user_id: 'user-c' });
  await waitFor(() => expect(screen.queryByText('carles')).toBeNull());
});

it('opens the profile of whoever sent it', async () => {
  await renderUi(<FriendRequestsScreen />);
  await fireEvent.press(await screen.findByText('Bea'));
  expect(router.push).toHaveBeenCalledWith('/user/user-b');
});

it('says when a request no longer exists and refreshes the list', async () => {
  results.accept_friend_request = { data: null, error: { message: 'request_not_found' } };
  await renderUi(<FriendRequestsScreen />);
  await screen.findByText('Bea');
  requests = [carles]; // Bea cancelled it meanwhile
  await fireEvent.press(screen.getAllByRole('button', { name: t('social.friendship.accept') })[0]!);
  expect(await screen.findByText(t('social.requests.gone'))).toBeOnTheScreen();
  await waitFor(() => expect(screen.queryByText('Bea')).toBeNull());
});

it('says when there are no requests', async () => {
  requests = [];
  await renderUi(<FriendRequestsScreen />);
  expect(await screen.findByText(t('social.requests.empty'))).toBeOnTheScreen();
});

it('links to the requests with their count', async () => {
  await renderUi(<FriendRequestsLink />);
  await fireEvent.press(await screen.findByRole('button', { name: t('social.requests.link', { count: 2 }) }));
  expect(router.push).toHaveBeenCalledWith('/friend-requests');
});

it('hides the link without requests', async () => {
  requests = [];
  await renderUi(<FriendRequestsLink />);
  await waitFor(() => expect(rpc).toHaveBeenCalledWith('my_friend_requests'));
  expect(screen.queryByRole('button')).toBeNull();
});
