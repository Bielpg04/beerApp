import { supabase } from '@/shared/lib/supabase';

import { expandUpcE, findBeerByBarcode } from '..';

jest.mock('@/shared/lib/supabase', () => ({
  supabase: { rpc: jest.fn(), functions: { invoke: jest.fn() } },
}));

const rpc = supabase.rpc as jest.Mock;
const invoke = supabase.functions.invoke as jest.Mock;

beforeEach(() => jest.clearAllMocks());

it('expands UPC-E codes to UPC-A', () => {
  expect(expandUpcE('04252614')).toBe('042100005264');
  expect(expandUpcE('01234505')).toBe('012000003455');
  expect(expandUpcE('5410228142249')).toBe('5410228142249');
});

it('finds a known beer in the catalog without calling the Edge Function', async () => {
  rpc.mockResolvedValue({ data: 'beer-1', error: null });
  await expect(findBeerByBarcode('5410228142249', 'ean13')).resolves.toEqual({
    status: 'found',
    beerId: 'beer-1',
  });
  expect(rpc).toHaveBeenCalledWith('beer_by_barcode', { code: '5410228142249' });
  expect(invoke).not.toHaveBeenCalled();
});

it('asks the Edge Function for unknown barcodes, sending UPC-E expanded', async () => {
  rpc.mockResolvedValue({ data: null, error: null });
  invoke.mockResolvedValue({ data: { status: 'imported', beerId: 'beer-2' }, error: null });
  await expect(findBeerByBarcode('04252614', 'upc_e')).resolves.toEqual({
    status: 'imported',
    beerId: 'beer-2',
  });
  expect(rpc).toHaveBeenCalledWith('beer_by_barcode', { code: '042100005264' });
  expect(invoke).toHaveBeenCalledWith('beer-lookup', { body: { barcode: '042100005264' } });
});

it('reports network problems as unavailable', async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } });
  await expect(findBeerByBarcode('5410228142249', 'ean13')).resolves.toEqual({ status: 'unavailable' });

  rpc.mockResolvedValue({ data: null, error: null });
  invoke.mockResolvedValue({ data: null, error: new Error('FunctionsFetchError') });
  await expect(findBeerByBarcode('5410228142249', 'ean13')).resolves.toEqual({ status: 'unavailable' });

  rpc.mockRejectedValue(new Error('offline'));
  await expect(findBeerByBarcode('5410228142249', 'ean13')).resolves.toEqual({ status: 'unavailable' });
});
