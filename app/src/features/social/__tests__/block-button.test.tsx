import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { i18n } from '@/shared/i18n';
import { supabase } from '@/shared/lib/supabase';

import { BlockButton } from '..';

jest.mock('@/shared/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));

const t = (key: string, options?: object) => i18n.t(key as never, options as never) as unknown as string;
const rpc = supabase.rpc as jest.Mock;

async function renderButton(blocked: boolean) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  await render(
    <QueryClientProvider client={client}>
      <BlockButton userId="user-b" username="bea" blocked={blocked} />
    </QueryClientProvider>,
  );
  return { invalidate };
}

beforeAll(() => i18n.changeLanguage('ca'));
beforeEach(() => {
  jest.clearAllMocks();
  rpc.mockResolvedValue({ data: null, error: null });
});

it('explains what blocking does and blocks only after confirming', async () => {
  const { invalidate } = await renderButton(false);
  await fireEvent.press(screen.getByRole('button', { name: t('social.block.open', { username: 'bea' }) }));
  expect(rpc).not.toHaveBeenCalled();
  expect(screen.getByText(t('social.block.explain'))).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: t('social.block.confirmYes') }));
  expect(rpc).toHaveBeenCalledWith('block_user', { user_id: 'user-b' });
  await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['profile'] }));
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['posts'] });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['social'] });
});

it('unblocks someone I blocked', async () => {
  await renderButton(true);
  await fireEvent.press(screen.getByRole('button', { name: t('social.block.unblock') }));
  expect(rpc).toHaveBeenCalledWith('unblock_user', { user_id: 'user-b' });
});

it('says so when it fails', async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'offline' } });
  await renderButton(true);
  await fireEvent.press(screen.getByRole('button', { name: t('social.block.unblock') }));
  expect(await screen.findByText(t('social.friendship.error'))).toBeOnTheScreen();
});
