import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { supabase } from '@/shared/lib/supabase';

import { useBeer } from '..';

const maybeSingle = jest.fn();
const eq = jest.fn(() => ({ maybeSingle }));
const select = jest.fn(() => ({ eq }));
jest.mock('@/shared/lib/supabase', () => ({ supabase: { rpc: jest.fn(), from: jest.fn() } }));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  jest.clearAllMocks();
  (supabase.from as jest.Mock).mockReturnValue({ select });
});

it('follows a merged beer to the final one and maps its row', async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({ data: 'final-id', error: null });
  maybeSingle.mockResolvedValue({
    data: {
      id: 'final-id',
      name: 'Westmalle Tripel',
      brand: 'Westmalle',
      abv: 9.5,
      country: 'BE',
      image_url: 'https://img/x.jpg',
      style_code: 'trappist',
      brewery: { name: 'Brouwerij Westmalle', city: 'Westmalle' },
    },
    error: null,
  });

  const { result } = await renderHook(() => useBeer('old-id'), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(supabase.rpc).toHaveBeenCalledWith('resolve_beer', { beer: 'old-id' });
  expect(eq).toHaveBeenCalledWith('id', 'final-id');
  expect(result.current.data).toEqual({
    id: 'final-id',
    name: 'Westmalle Tripel',
    brand: 'Westmalle',
    abv: 9.5,
    country: 'BE',
    imageUrl: 'https://img/x.jpg',
    styleCode: 'trappist',
    brewery: { name: 'Brouwerij Westmalle', city: 'Westmalle' },
  });
});

it('returns null when the beer does not exist', async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({ data: null, error: null });
  const { result } = await renderHook(() => useBeer('missing'), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toBeNull();
  expect(supabase.from).not.toHaveBeenCalled();
});
