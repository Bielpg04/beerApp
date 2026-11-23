import { supabase } from '@/shared/lib/supabase';

import { fetchBeerSummary } from '..';

jest.mock('@/shared/lib/supabase', () => ({ supabase: { rpc: jest.fn(), from: jest.fn() } }));
const rpc = supabase.rpc as jest.Mock;
const maybeSingle = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (supabase.from as jest.Mock).mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle }) }) });
});

it('follows merges and returns what a picker shows', async () => {
  rpc.mockResolvedValue({ data: 'final', error: null });
  maybeSingle.mockResolvedValue({
    data: {
      id: 'final',
      name: 'Moritz',
      brand: 'Moritz',
      image_thumb_url: null,
      abv: 5.4,
      style_code: 'lager',
    },
    error: null,
  });
  await expect(fetchBeerSummary('old')).resolves.toEqual({
    id: 'final',
    name: 'Moritz',
    brand: 'Moritz',
    imageThumbUrl: null,
    abv: 5.4,
    styleCode: 'lager',
  });
  expect(rpc).toHaveBeenCalledWith('resolve_beer', { beer: 'old' });
});

it('returns null for an unknown beer and throws on errors', async () => {
  rpc.mockResolvedValue({ data: null, error: null });
  await expect(fetchBeerSummary('x')).resolves.toBeNull();
  rpc.mockResolvedValue({ data: null, error: new Error('offline') });
  await expect(fetchBeerSummary('x')).rejects.toThrow('offline');
});
