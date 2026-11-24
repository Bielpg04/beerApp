import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { i18n } from '@/shared/i18n';
import { supabase } from '@/shared/lib/supabase';

import { NewPostScreen, usePostDraft } from '..';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock('@/shared/lib/supabase', () => ({ supabase: { rpc: jest.fn(), from: jest.fn() } }));

const rpc = supabase.rpc as jest.Mock;
const t = (key: string, options?: object) => i18n.t(key as never, options as never) as unknown as string;

type BeerRowData = {
  id: string;
  name: string;
  brand: string;
  image_thumb_url: string | null;
  abv: number | null;
  style_code: string | null;
};

const damm: BeerRowData = {
  id: 'b1',
  name: 'Estrella Damm',
  brand: 'Damm',
  image_thumb_url: null,
  abv: 5.4,
  style_code: 'lager',
};
const moritz: BeerRowData = {
  id: 'b2',
  name: 'Moritz',
  brand: 'Moritz',
  image_thumb_url: null,
  abv: 5.4,
  style_code: null,
};

let recentRows: { beer: BeerRowData }[] = [];

function mockRecent() {
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    limit: () => Promise.resolve({ data: recentRows, error: null }),
  };
  (supabase.from as jest.Mock).mockReturnValue(chain);
}

async function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  await render(
    <QueryClientProvider client={client}>
      <NewPostScreen userId="u1" />
    </QueryClientProvider>,
  );
}

async function pickDamm() {
  rpc.mockResolvedValueOnce({ data: [damm], error: null });
  await fireEvent.changeText(screen.getByLabelText(t('posts.new.searchLabel')), 'estrella');
  await fireEvent.press(await screen.findByRole('button', { name: 'Estrella Damm, Damm' }));
}

beforeAll(() => i18n.changeLanguage('ca'));
beforeEach(() => {
  jest.clearAllMocks();
  usePostDraft.getState().reset();
  recentRows = [];
  mockRecent();
});

it('finds a beer by name and moves on to the photo', async () => {
  await renderScreen();
  await pickDamm();
  expect(rpc).toHaveBeenCalledWith('search_beers', { q: 'estrella', max_results: 20 });
  expect(await screen.findByRole('header', { name: t('posts.new.photoTitle') })).toBeOnTheScreen();
  expect(usePostDraft.getState().beer?.id).toBe('b1');
});

it('offers the beers you logged recently, once each', async () => {
  recentRows = [{ beer: moritz }, { beer: damm }, { beer: moritz }];
  await renderScreen();
  expect(await screen.findByText(t('posts.new.recent'))).toBeOnTheScreen();
  expect(screen.getAllByRole('button', { name: 'Moritz, Moritz' })).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Estrella Damm, Damm' })).toBeOnTheScreen();
});

it('says when nothing matches and offers the scanner', async () => {
  await renderScreen();
  rpc.mockResolvedValueOnce({ data: [], error: null });
  await fireEvent.changeText(screen.getByLabelText(t('posts.new.searchLabel')), 'zzzz');
  expect(await screen.findByText(t('posts.new.noResults'))).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: t('posts.new.scan') }));
  expect(router.push).toHaveBeenCalledWith('/scan?for=post');
});

it('needs a serving before publishing', async () => {
  await renderScreen();
  await pickDamm();
  await fireEvent.press(await screen.findByRole('button', { name: t('posts.new.noPhoto') }));
  const publish = await screen.findByRole('button', { name: t('posts.new.publish') });
  expect(publish).toBeDisabled();
  await fireEvent.press(screen.getByRole('radio', { name: t('posts.serving.bottle') }));
  expect(screen.getByRole('button', { name: t('posts.new.publish') })).toBeEnabled();
});

it('publishes, opens the post and clears the draft', async () => {
  await renderScreen();
  await pickDamm();
  await fireEvent.press(await screen.findByRole('button', { name: t('posts.new.noPhoto') }));
  await fireEvent.press(await screen.findByRole('radio', { name: t('posts.serving.tap') }));
  await fireEvent.press(screen.getByRole('radio', { name: '500 ml' }));
  await fireEvent.changeText(screen.getByLabelText(t('posts.new.caption')), 'Al sol');
  rpc.mockResolvedValueOnce({ data: 'post-1', error: null });
  await fireEvent.press(screen.getByRole('button', { name: t('posts.new.publish') }));
  await waitFor(() => expect(router.push).toHaveBeenCalledWith('/post/post-1'));
  expect(rpc).toHaveBeenLastCalledWith('create_post', {
    beer_id: 'b1',
    serving: 'tap',
    volume_ml: 500,
    caption: 'Al sol',
    photo: null,
  });
  expect(usePostDraft.getState().beer).toBeNull();
});

it('accepts another volume', async () => {
  await renderScreen();
  await pickDamm();
  await fireEvent.press(await screen.findByRole('button', { name: t('posts.new.noPhoto') }));
  await fireEvent.press(await screen.findByRole('radio', { name: t('posts.new.otherVolume') }));
  await fireEvent.changeText(screen.getByLabelText(t('posts.new.volumeMl')), '440');
  expect(usePostDraft.getState().volumeMl).toBe(440);
});

it('keeps the draft and says so when publishing fails', async () => {
  await renderScreen();
  await pickDamm();
  await fireEvent.press(await screen.findByRole('button', { name: t('posts.new.noPhoto') }));
  await fireEvent.press(await screen.findByRole('radio', { name: t('posts.serving.can') }));
  rpc.mockResolvedValueOnce({ data: null, error: { message: 'offline' } });
  await fireEvent.press(screen.getByRole('button', { name: t('posts.new.publish') }));
  expect(await screen.findByText(t('posts.new.publishError'))).toBeOnTheScreen();
  expect(router.push).not.toHaveBeenCalled();
  expect(usePostDraft.getState().beer?.id).toBe('b1');
});

it('goes back a step without losing the beer', async () => {
  await renderScreen();
  await pickDamm();
  await fireEvent.press(await screen.findByRole('button', { name: t('posts.new.back') }));
  expect(await screen.findByLabelText(t('posts.new.searchLabel'))).toBeOnTheScreen();
  expect(usePostDraft.getState().beer?.id).toBe('b1');
});

it('discards a draft after confirming', async () => {
  usePostDraft.setState({
    beer: { id: 'b1', name: 'Estrella Damm', brand: 'Damm', imageThumbUrl: null, abv: null, styleCode: null },
    step: 'details',
    caption: 'x',
  });
  await renderScreen();
  await fireEvent.press(screen.getByRole('button', { name: t('posts.new.discard') }));
  await fireEvent.press(await screen.findByRole('button', { name: t('posts.new.discardConfirmYes') }));
  expect(usePostDraft.getState().beer).toBeNull();
  expect(await screen.findByLabelText(t('posts.new.searchLabel'))).toBeOnTheScreen();
});

it('does not offer to discard an empty draft', async () => {
  await renderScreen();
  expect(screen.queryByRole('button', { name: t('posts.new.discard') })).toBeNull();
});
