import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { i18n } from '@/shared/i18n';
import { supabase } from '@/shared/lib/supabase';

import { FriendsLink, FriendsScreen } from '..';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/shared/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    storage: { from: () => ({ getPublicUrl: (p: string) => ({ data: { publicUrl: `https://cdn/${p}` } }) }) },
  },
}));

const t = (key: string, options?: object) => i18n.t(key as never, options as never) as unknown as string;
const rpc = supabase.rpc as jest.Mock;
const friend = (id: string, name: string) => ({
  id,
  username: name.toLowerCase(),
  display_name: name,
  avatar_path: null,
  since: '2026-11-24T10:00:00Z',
});
let friends: ReturnType<typeof friend>[] = [];

async function renderUi(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  await render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeAll(() => i18n.changeLanguage('ca'));
beforeEach(() => {
  jest.clearAllMocks();
  friends = [friend('user-b', 'Bea'), friend('user-c', 'Carles')];
  rpc.mockImplementation(async (fn: string) =>
    fn === 'my_friends' ? { data: friends, error: null } : { data: [], error: null },
  );
});

it('lists my friends in the order the server gives', async () => {
  await renderUi(<FriendsScreen />);
  expect(await screen.findByText('Bea')).toBeOnTheScreen();
  const names = screen.getAllByRole('link').map((el) => el.props.accessibilityLabel);
  expect(names).toEqual(['Bea', 'Carles']);
});

it('opens a friend', async () => {
  await renderUi(<FriendsScreen />);
  await fireEvent.press(await screen.findByText('Carles'));
  expect(router.push).toHaveBeenCalledWith('/user/user-c');
});

it('says when I have no friends yet and how to find some', async () => {
  friends = [];
  await renderUi(<FriendsScreen />);
  expect(await screen.findByText(t('social.friends.empty'))).toBeOnTheScreen();
  expect(screen.getByText(t('social.friends.emptyHint'))).toBeOnTheScreen();
});

it('links to my friends with their count', async () => {
  await renderUi(<FriendsLink />);
  await fireEvent.press(await screen.findByRole('button', { name: t('social.friends.link', { count: 2 }) }));
  expect(router.push).toHaveBeenCalledWith('/friends');
});
