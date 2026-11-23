import { fireEvent, render, screen } from '@testing-library/react-native';
import { openBrowserAsync } from 'expo-web-browser';

import { i18n } from '@/shared/i18n';

import { AboutScreen } from '..';

jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.2.3' } } }));

const t = (key: string, options?: object) => i18n.t(key as never, options as never) as unknown as string;

beforeEach(() => jest.clearAllMocks());

it('shows the app version', async () => {
  await render(<AboutScreen />);
  expect(screen.getByText(t('about.version', { version: '1.2.3' }))).toBeTruthy();
});

it('credits Open Food Facts and Open Brewery DB with their licences', async () => {
  await render(<AboutScreen />);
  expect(screen.getByText(t('about.offLicence'))).toBeTruthy();
  expect(screen.getByText(t('about.obdbLicence'))).toBeTruthy();
});

it('opens the sources in the browser', async () => {
  await render(<AboutScreen />);
  fireEvent.press(screen.getByRole('link', { name: 'Open Food Facts' }));
  expect(openBrowserAsync).toHaveBeenCalledWith('https://world.openfoodfacts.org');
  fireEvent.press(screen.getByRole('link', { name: 'Open Brewery DB' }));
  expect(openBrowserAsync).toHaveBeenCalledWith('https://www.openbrewerydb.org');
});
