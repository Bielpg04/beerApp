import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { supabase } from '@/shared/lib/supabase';

import { useBeerSearch } from '..';

jest.mock('@/shared/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));
const rpc = supabase.rpc as jest.Mock;

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => jest.clearAllMocks());

it('does not search with fewer than 2 characters', async () => {
  const { result } = await renderHook(() => useBeerSearch(' e '), { wrapper });
  expect(result.current.fetchStatus).toBe('idle');
  expect(rpc).not.toHaveBeenCalled();
});

it('searches the trimmed query and maps the rows', async () => {
  rpc.mockResolvedValue({
    data: [
      {
        id: 'b1',
        name: 'Estrella Damm',
        brand: 'Damm',
        image_thumb_url: 'https://t/1.jpg',
        abv: 5.4,
        style_code: 'lager',
      },
    ],
    error: null,
  });
  const { result } = await renderHook(() => useBeerSearch('  estrella damm '), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(rpc).toHaveBeenCalledWith('search_beers', { q: 'estrella damm', max_results: 20 });
  expect(result.current.data).toEqual([
    {
      id: 'b1',
      name: 'Estrella Damm',
      brand: 'Damm',
      imageThumbUrl: 'https://t/1.jpg',
      abv: 5.4,
      styleCode: 'lager',
    },
  ]);
});

it('reports errors', async () => {
  rpc.mockResolvedValue({ data: null, error: new Error('offline') });
  const { result } = await renderHook(() => useBeerSearch('damm'), { wrapper });
  await waitFor(() => expect(result.current.isError).toBe(true));
});
