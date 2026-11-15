import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { i18n } from '@/shared/i18n';

import { BeerScreen, beerKey, type Beer } from '..';

jest.mock('@/shared/lib/supabase', () => ({ supabase: { rpc: jest.fn(), from: jest.fn() } }));

const t = (key: string, options?: object) => i18n.t(key as never, options as never) as unknown as string;

const westmalle: Beer = {
  id: 'w',
  name: 'Westmalle Tripel',
  brand: 'Westmalle',
  abv: 9.5,
  country: 'BE',
  imageUrl: 'https://img/x.jpg',
  styleCode: 'trappist',
  brewery: { name: 'Brouwerij Westmalle', city: 'Westmalle' },
};

async function renderWith(beer: Beer | null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(beerKey('w'), beer);
  await render(
    <QueryClientProvider client={client}>
      <BeerScreen id="w" />
    </QueryClientProvider>,
  );
}

beforeAll(() => i18n.changeLanguage('ca'));

it('shows everything we know about a beer', async () => {
  await renderWith(westmalle);
  expect(screen.getByText('Westmalle Tripel')).toBeOnTheScreen();
  expect(screen.getByText('Westmalle')).toBeOnTheScreen();
  expect(screen.getByText('Brouwerij Westmalle · Westmalle')).toBeOnTheScreen();
  expect(screen.getByText(t('beers.styles.trappist'))).toBeOnTheScreen();
  expect(screen.getByText('9,5 %')).toBeOnTheScreen();
  expect(screen.getByText('🇧🇪 Bèlgica')).toBeOnTheScreen();
  expect(screen.getByText(t('beers.source'))).toBeOnTheScreen();
  expect(screen.getByLabelText(t('beers.imageLabel', { name: 'Westmalle Tripel' }))).toBeOnTheScreen();
});

it('copes with a beer that only has a name and a brand', async () => {
  await renderWith({
    ...westmalle,
    abv: null,
    styleCode: null,
    brewery: null,
    imageUrl: null,
    country: null,
  });
  expect(screen.getByText('—')).toBeOnTheScreen();
  expect(screen.queryByText(t('beers.brewery'))).toBeNull();
  expect(screen.queryByText(t('beers.style'))).toBeNull();
  expect(screen.queryByText(t('beers.country'))).toBeNull();
  expect(screen.getByText('🍺')).toBeOnTheScreen();
});

it('shows a country outside Europe by its flag and code', async () => {
  await renderWith({ ...westmalle, country: 'JP' });
  expect(screen.getByText('🇯🇵 JP')).toBeOnTheScreen();
});

it('says so when the beer does not exist', async () => {
  await renderWith(null);
  expect(screen.getByText(t('beers.notFound'))).toBeOnTheScreen();
});

it('offers a retry when loading fails', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { supabase } = jest.requireMock('@/shared/lib/supabase');
  supabase.rpc.mockResolvedValueOnce({ data: null, error: new Error('offline') });
  supabase.rpc.mockResolvedValueOnce({ data: null, error: null });
  await render(
    <QueryClientProvider client={client}>
      <BeerScreen id="w" />
    </QueryClientProvider>,
  );
  fireEvent.press(await screen.findByRole('button', { name: t('common.retry') }));
  expect(await screen.findByText(t('beers.notFound'))).toBeOnTheScreen();
});

it('falls back to the placeholder when the image cannot be loaded', async () => {
  await renderWith(westmalle);
  fireEvent(screen.getByLabelText(t('beers.imageLabel', { name: 'Westmalle Tripel' })), 'error', {
    nativeEvent: { error: 'HTTP 404' },
  });
  expect(await screen.findByText('🍺')).toBeOnTheScreen();
});
