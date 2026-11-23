import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Linking } from 'react-native';

import { i18n } from '@/shared/i18n';

import { ScanButton, ScanScreen } from '..';
import { findBeerByBarcode } from '../api/find-by-barcode';
import type { LookupResult } from '../types';

type CameraProps = {
  onBarcodeScanned?: (r: { type: string; data: string }) => void;
  barcodeScannerSettings?: unknown;
};
let mockCameraProps: CameraProps = {};
let mockPermission: { granted: boolean; canAskAgain: boolean } | null = { granted: true, canAskAgain: true };
const mockRequestPermission = jest.fn();

jest.mock('expo-camera', () => ({
  CameraView: (props: CameraProps) => {
    mockCameraProps = props;
    return null;
  },
  useCameraPermissions: () => [mockPermission, mockRequestPermission],
}));
jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() } }));
jest.mock('../api/find-by-barcode', () => ({ findBeerByBarcode: jest.fn() }));
jest.mock('@/shared/lib/supabase', () => ({ supabase: {} }));

const t = (key: string) => i18n.t(key as never) as unknown as string;
const find = findBeerByBarcode as jest.Mock;

async function scan(data = '5410228142249', type = 'ean13') {
  await act(async () => mockCameraProps.onBarcodeScanned?.({ type, data }));
}

beforeAll(() => i18n.changeLanguage('ca'));
beforeEach(() => {
  jest.clearAllMocks();
  mockCameraProps = {};
  mockPermission = { granted: true, canAskAgain: true };
});

it('reads only beer barcode types', async () => {
  await render(<ScanScreen />);
  expect(mockCameraProps.barcodeScannerSettings).toEqual({
    barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'],
  });
});

it('looks a code up once even if the camera reads it many times', async () => {
  find.mockReturnValue(new Promise(() => {}));
  await render(<ScanScreen />);
  for (let i = 0; i < 10; i++) await scan();
  await scan('96385074', 'ean8');
  expect(find).toHaveBeenCalledTimes(1);
  expect(find).toHaveBeenCalledWith('5410228142249', 'ean13');
});

it.each<LookupResult>([
  { status: 'found', beerId: 'b1' },
  { status: 'imported', beerId: 'b1' },
])('opens the beer when the lookup says $status', async (result) => {
  find.mockResolvedValue(result);
  await render(<ScanScreen />);
  await scan();
  await act(async () => {});
  expect(router.replace).toHaveBeenCalledWith('/beer/b1');
});

it.each([
  ['not_found', 'beers.scan.notFound'],
  ['not_beer', 'beers.scan.notBeer'],
  ['unavailable', 'beers.scan.unavailable'],
  ['rate_limited', 'beers.scan.rateLimited'],
  ['invalid', 'beers.scan.invalid'],
] as const)('explains a %s result', async (status, key) => {
  find.mockResolvedValue({ status });
  await render(<ScanScreen />);
  await scan();
  expect(await screen.findByText(t(key))).toBeOnTheScreen();
});

it('shows the code of a beer we do not have yet and that it can be added soon', async () => {
  find.mockResolvedValue({ status: 'not_found' });
  await render(<ScanScreen />);
  await scan();
  expect(await screen.findByText('5410228142249')).toBeOnTheScreen();
  expect(screen.getByText(t('beers.scan.addSoon'))).toBeOnTheScreen();
});

it('scans again after a result', async () => {
  find
    .mockResolvedValueOnce({ status: 'unavailable' })
    .mockResolvedValueOnce({ status: 'found', beerId: 'b2' });
  await render(<ScanScreen />);
  await scan();
  await fireEvent.press(await screen.findByRole('button', { name: t('beers.scan.again') }));
  await scan('96385074', 'ean8');
  await act(async () => {});
  expect(router.replace).toHaveBeenCalledWith('/beer/b2');
});

it('asks for the camera when it may', async () => {
  mockPermission = { granted: false, canAskAgain: true };
  await render(<ScanScreen />);
  await fireEvent.press(screen.getByRole('button', { name: t('beers.scan.allowCamera') }));
  expect(mockRequestPermission).toHaveBeenCalled();
});

it('sends to the settings when the camera was denied for good', async () => {
  mockPermission = { granted: false, canAskAgain: false };
  const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
  await render(<ScanScreen />);
  expect(screen.getByText(t('beers.scan.cameraDenied'))).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: t('beers.scan.openSettings') }));
  expect(openSettings).toHaveBeenCalled();
});

it('the scan button opens the scanner', async () => {
  await render(<ScanButton />);
  await fireEvent.press(screen.getByRole('button', { name: t('beers.scan.open') }));
  expect(router.push).toHaveBeenCalledWith('/scan');
});

it('does nothing when the lookup finishes after the scanner was closed', async () => {
  let resolve: (r: LookupResult) => void = () => {};
  find.mockReturnValue(new Promise<LookupResult>((r) => (resolve = r)));
  const { unmount } = await render(<ScanScreen />);
  await scan();
  await unmount();
  await act(async () => resolve({ status: 'imported', beerId: 'b9' }));
  expect(router.replace).not.toHaveBeenCalled();
});
