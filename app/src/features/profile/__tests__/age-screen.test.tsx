import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { i18n } from '@/shared/i18n';
import { supabase } from '@/shared/lib/supabase';

import { AgeScreen } from '..';

jest.mock('@/shared/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'ca', regionCode: 'ES' }] }));

const rpc = supabase.rpc as jest.Mock;
const t = (key: string, opts?: object) => i18n.t(key as never, opts as never) as unknown as string;

async function renderScreen() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  await render(
    <QueryClientProvider client={client}>
      <AgeScreen />
    </QueryClientProvider>,
  );
  return { invalidate };
}

async function enterBirthdate(d: string, m: string, y: string) {
  await fireEvent.changeText(screen.getByLabelText(t('onboarding.age.day')), d);
  await fireEvent.changeText(screen.getByLabelText(t('onboarding.age.month')), m);
  await fireEvent.changeText(screen.getByLabelText(t('onboarding.age.year')), y);
}

const submit = () => screen.getByRole('button', { name: t('onboarding.age.submit') });

beforeAll(() => i18n.changeLanguage('ca'));
beforeEach(() => {
  jest.clearAllMocks();
  rpc.mockResolvedValue({ data: null, error: null });
});

it('preselects the device country', async () => {
  await renderScreen();
  expect(screen.getByRole('button', { name: new RegExp(t('onboarding.age.country')) })).toHaveTextContent(
    /Espanya/,
  );
});

it('tells a minor they cannot continue and disables the button', async () => {
  await renderScreen();
  const year = String(new Date().getUTCFullYear() - 10);
  await enterBirthdate('1', '1', year);
  expect(screen.getByText(t('onboarding.age.underage', { age: 18 }))).toBeOnTheScreen();
  expect(submit()).toBeDisabled();
  expect(rpc).not.toHaveBeenCalled();
});

it('saves the birthdate and country, then refreshes the profile', async () => {
  const { invalidate } = await renderScreen();
  await enterBirthdate('20', '5', '2000');
  await fireEvent.press(submit());
  await waitFor(() =>
    expect(rpc).toHaveBeenCalledWith('set_birthdate', { birthdate: '2000-05-20', country: 'ES' }),
  );
  await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['profile', 'me'] }));
});

it('shows the underage message when the server rejects the age', async () => {
  rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'underage' } });
  await renderScreen();
  await enterBirthdate('20', '5', '2000');
  await fireEvent.press(submit());
  expect(await screen.findByText(t('onboarding.age.underage', { age: 18 }))).toBeOnTheScreen();
});
