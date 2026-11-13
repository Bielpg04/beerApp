import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import type { RouteState } from '@/features/auth';
import { i18n } from '@/shared/i18n';

let mockState: RouteState = 'ready';
jest.mock('@/features/auth', () => ({
  ...jest.requireActual('@/features/auth'),
  useRouteState: () => mockState,
}));

const t = (key: string) => i18n.t(key as never) as unknown as string;

beforeAll(() => i18n.changeLanguage('ca'));

describe('when ready', () => {
  beforeEach(() => (mockState = 'ready'));

  it.each([
    ['/', 'Feed'],
    ['/search', 'Cerca'],
    ['/new-post', 'Nova cervesa'],
    ['/map', 'Mapa'],
  ])('%s renders the %s tab', async (url, title) => {
    await renderRouter('./src/app', { initialUrl: url });
    expect(screen).toHavePathname(url);
    expect(screen.getByRole('header', { name: title })).toBeOnTheScreen();
  });

  it('opens the profile tab', async () => {
    await renderRouter('./src/app', { initialUrl: '/profile' });
    expect(screen).toHavePathname('/profile');
  });

  it('cannot open the login screen', async () => {
    await renderRouter('./src/app', { initialUrl: '/login' });
    expect(screen).not.toHavePathname('/login');
  });
});

describe('route guards', () => {
  it('sends signed-out users to login', async () => {
    mockState = 'signedOut';
    await renderRouter('./src/app', { initialUrl: '/' });
    expect(screen).toHavePathname('/login');
    expect(screen.getByRole('header', { name: t('auth.login.title') })).toBeOnTheScreen();
  });

  it('keeps a user who has not entered their age in the age step, whatever they open', async () => {
    mockState = 'needsAge';
    await renderRouter('./src/app', { initialUrl: '/map' });
    expect(screen).toHavePathname('/onboarding/age');
  });

  it('sends a user with age but no profile to the profile step', async () => {
    mockState = 'needsProfile';
    await renderRouter('./src/app', { initialUrl: '/' });
    expect(screen).toHavePathname('/onboarding/profile');
  });
});

it('lets signed-out users open the code screen', async () => {
  mockState = 'signedOut';
  await renderRouter('./src/app', { initialUrl: '/verify?email=biel%40example.com' });
  expect(screen).toHavePathname('/verify');
  expect(screen.getByRole('header', { name: t('auth.code.title') })).toBeOnTheScreen();
});

it('offers a retry when the profile cannot be loaded (e.g. offline)', async () => {
  mockState = 'error';
  const { queryClient } = jest.requireActual('@/shared/lib/query-client');
  const refetch = jest.spyOn(queryClient, 'refetchQueries');
  await renderRouter('./src/app', { initialUrl: '/' });
  expect(screen.getByText(t('common.connectionError'))).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: t('common.retry') }));
  expect(refetch).toHaveBeenCalledWith({ queryKey: ['profile', 'me'] });
});
