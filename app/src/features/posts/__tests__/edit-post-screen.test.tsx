import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { i18n } from '@/shared/i18n';
import { supabase } from '@/shared/lib/supabase';

import { EditPostScreen, postKey, type Post } from '..';

jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() } }));
jest.mock('@/shared/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));
jest.mock('@expo/ui/community/datetime-picker', () => ({ DateTimePicker: () => null }));

const rpc = supabase.rpc as jest.Mock;
const t = (key: string, options?: object) => i18n.t(key as never, options as never) as unknown as string;

const post: Post = {
  id: 'p1',
  authorId: 'u1',
  beer: { id: 'b1', name: 'Estrella Damm', brand: 'Damm', imageThumbUrl: null },
  serving: 'bottle',
  volumeMl: 330,
  caption: 'Al sol',
  consumedAt: '2026-11-20T20:15:00.000Z',
  isRetroactive: true,
  publishToFeed: false,
  verificationLevel: 'unverified',
  createdAt: '2026-11-23T10:00:00.000Z',
  photo: null,
};

let client: QueryClient;
async function renderEdit(value: Post = post) {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } },
  });
  client.setQueryData(postKey('p1'), value);
  await render(
    <QueryClientProvider client={client}>
      <EditPostScreen id="p1" />
    </QueryClientProvider>,
  );
}

beforeAll(() => i18n.changeLanguage('ca'));
beforeEach(() => jest.clearAllMocks());

it('starts from the post as it is, with the beer read-only', async () => {
  await renderEdit();
  expect(screen.getByText('Estrella Damm')).toBeOnTheScreen();
  expect(screen.getByRole('radio', { name: t('posts.serving.bottle') })).toBeChecked();
  expect(screen.getByRole('radio', { name: '330 ml' })).toBeChecked();
  expect(screen.getByLabelText(t('posts.new.caption'))).toHaveDisplayValue('Al sol');
  expect(screen.getByRole('switch', { name: t('posts.when.feed') })).not.toBeChecked();
  expect(screen.getByText(t('posts.edit.beerFixed'))).toBeOnTheScreen();
});

it('saves the edited fields and goes back', async () => {
  rpc.mockResolvedValue({ data: null, error: null });
  await renderEdit();
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  await fireEvent.press(screen.getByRole('radio', { name: t('posts.serving.can') }));
  await fireEvent.changeText(screen.getByLabelText(t('posts.new.caption')), 'Millor a la fresca');
  await fireEvent(screen.getByRole('switch', { name: t('posts.when.feed') }), 'valueChange', true);
  await fireEvent.press(screen.getByRole('button', { name: t('common.save') }));
  await waitFor(() => expect(router.back).toHaveBeenCalled());
  expect(rpc).toHaveBeenCalledWith('update_post', {
    post_id: 'p1',
    serving: 'can',
    volume_ml: 330,
    caption: 'Millor a la fresca',
    consumed_at: '2026-11-20T20:15:00.000Z',
    publish_to_feed: true,
  });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['posts'] });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['post', 'p1'] });
});

it('says so when saving fails and stays', async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'offline' } });
  await renderEdit();
  await fireEvent.press(screen.getByRole('button', { name: t('common.save') }));
  expect(await screen.findByText(t('posts.edit.saveError'))).toBeOnTheScreen();
  expect(router.back).not.toHaveBeenCalled();
});

it('does not let a verified post change its date', async () => {
  await renderEdit({ ...post, verificationLevel: 'verified' });
  expect(screen.queryByRole('radio', { name: t('posts.when.now') })).toBeNull();
  expect(screen.getByText(t('posts.edit.dateLocked'))).toBeOnTheScreen();
});
