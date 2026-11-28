import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { i18n } from '@/shared/i18n';
import { supabase } from '@/shared/lib/supabase';

import { BlockedUsersLink, BlockedUsersScreen } from '..';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/shared/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    storage: { from: () => ({ getPublicUrl: (p: string) => ({ data: { publicUrl: `https://cdn/${p}` } }) }) },
  },
}));

const t = (key: string, options?: object) => i18n.t(key as never, options as never) as unknown as string;
const rpc = supabase.rpc as jest.Mock;
let blocked: { id: string; username: string; display_name: string; avatar_path: null; blocked_at: string }[] =
  [];

async function renderUi(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  await render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeAll(() => i18n.changeLanguage('ca'));
beforeEach(() => {
  jest.clearAllMocks();
  blocked = [
    {
      id: 'user-b',
      username: 'bea',
      display_name: 'Bea',
      avatar_path: null,
      blocked_at: '2026-11-24T10:00:00Z',
    },
  ];
  rpc.mockImplementation(async (fn: string, args?: { user_id: string }) => {
    if (fn === 'my_blocked_users') return { data: blocked, error: null };
    if (fn === 'unblock_user') blocked = blocked.filter((b) => b.id !== args?.user_id);
    return { data: null, error: null };
  });
});

it('lists the people I blocked and unblocks one after confirming', async () => {
  await renderUi(<BlockedUsersScreen />);
  expect(await screen.findByText('Bea')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: t('social.block.unblock') }));
  expect(rpc).not.toHaveBeenCalledWith('unblock_user', expect.anything());
  expect(screen.getByText(t('social.blocked.unblockConfirm', { username: 'bea' }))).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: t('social.blocked.unblockYes') }));
  expect(rpc).toHaveBeenCalledWith('unblock_user', { user_id: 'user-b' });
  expect(await screen.findByText(t('social.blocked.empty'))).toBeOnTheScreen();
});

it('says when I have not blocked anyone', async () => {
  blocked = [];
  await renderUi(<BlockedUsersScreen />);
  expect(await screen.findByText(t('social.blocked.empty'))).toBeOnTheScreen();
});

it('links to the blocked users from my profile', async () => {
  await renderUi(<BlockedUsersLink />);
  await fireEvent.press(screen.getByRole('button', { name: t('social.blocked.title') }));
  await waitFor(() => expect(router.push).toHaveBeenCalledWith('/blocked'));
});
