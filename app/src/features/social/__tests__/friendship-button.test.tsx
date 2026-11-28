import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { i18n } from '@/shared/i18n';
import { supabase } from '@/shared/lib/supabase';

import { FriendshipButton, type Relationship } from '..';

jest.mock('@/shared/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));

const t = (key: string, options?: object) => i18n.t(key as never, options as never) as unknown as string;
const rpc = supabase.rpc as jest.Mock;

async function renderButton(relationship: Relationship) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  await render(
    <QueryClientProvider client={client}>
      <FriendshipButton userId="user-b" username="bea" relationship={relationship} />
    </QueryClientProvider>,
  );
  return { invalidate };
}

const button = (key: string) => screen.getByRole('button', { name: t(key) });

beforeAll(() => i18n.changeLanguage('ca'));
beforeEach(() => {
  jest.clearAllMocks();
  rpc.mockResolvedValue({ data: null, error: null });
});

it('sends a request to someone who is not a friend, then refreshes what depends on it', async () => {
  const { invalidate } = await renderButton('none');
  await fireEvent.press(button('social.friendship.add'));
  expect(rpc).toHaveBeenCalledWith('send_friend_request', { user_id: 'user-b' });
  await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['profile'] }));
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['posts'] });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['social'] });
});

it('lets me cancel a request I sent', async () => {
  await renderButton('outgoing');
  expect(screen.getByText(t('social.friendship.sent'))).toBeOnTheScreen();
  await fireEvent.press(button('social.friendship.cancel'));
  expect(rpc).toHaveBeenCalledWith('remove_friend', { user_id: 'user-b' });
});

it('lets me accept or decline a request I received', async () => {
  await renderButton('incoming');
  expect(screen.getByText(t('social.friendship.received', { username: 'bea' }))).toBeOnTheScreen();
  await fireEvent.press(button('social.friendship.accept'));
  expect(rpc).toHaveBeenCalledWith('accept_friend_request', { user_id: 'user-b' });
  await fireEvent.press(button('social.friendship.decline'));
  expect(rpc).toHaveBeenCalledWith('decline_friend_request', { user_id: 'user-b' });
});

it('asks before ending a friendship', async () => {
  await renderButton('friends');
  expect(screen.getByText(t('social.friendship.friends'))).toBeOnTheScreen();
  await fireEvent.press(button('social.friendship.remove'));
  expect(rpc).not.toHaveBeenCalled();
  expect(screen.getByText(t('social.friendship.removeConfirm', { username: 'bea' }))).toBeOnTheScreen();
  await fireEvent.press(button('social.friendship.removeYes'));
  expect(rpc).toHaveBeenCalledWith('remove_friend', { user_id: 'user-b' });
});

it('says so when the action fails', async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'offline' } });
  await renderButton('none');
  await fireEvent.press(button('social.friendship.add'));
  expect(await screen.findByText(t('social.friendship.error'))).toBeOnTheScreen();
});

it('shows nothing on my own profile or for someone I blocked', async () => {
  await renderButton('self');
  expect(screen.queryByRole('button')).toBeNull();
  await renderButton('blocked');
  expect(screen.queryByRole('button')).toBeNull();
});
