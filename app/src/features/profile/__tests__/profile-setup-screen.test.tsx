import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { i18n } from '@/shared/i18n';
import { supabase } from '@/shared/lib/supabase';

import { myProfileKey, ProfileSetupScreen } from '..';

jest.mock('@/shared/lib/supabase', () => ({ supabase: { rpc: jest.fn(), from: jest.fn() } }));
jest.mock('../api/avatar', () => ({
  pickAndUploadAvatar: jest.fn(),
  avatarUrl: jest.fn(() => null),
  AvatarPermissionError: class extends Error {},
}));

const rpc = supabase.rpc as jest.Mock;
const t = (key: string) => i18n.t(key as never) as unknown as string;

async function renderScreen(displayName: string | null = null) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(myProfileKey, { id: 'user-1', display_name: displayName, avatar_path: null });
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  await render(
    <QueryClientProvider client={client}>
      <ProfileSetupScreen />
    </QueryClientProvider>,
  );
  return { invalidate };
}

const fill = async (username: string, name?: string) => {
  await fireEvent.changeText(screen.getByLabelText(t('onboarding.profile.username')), username);
  if (name !== undefined)
    await fireEvent.changeText(screen.getByLabelText(t('onboarding.profile.displayName')), name);
};
const submit = () => fireEvent.press(screen.getByRole('button', { name: t('onboarding.profile.submit') }));

beforeAll(() => i18n.changeLanguage('ca'));
beforeEach(() => {
  rpc.mockReset();
  rpc.mockImplementation(async (fn: string) =>
    fn === 'username_available' ? { data: true, error: null } : { data: null, error: null },
  );
});

it('prefills the name given by Apple or Google', async () => {
  await renderScreen('Anna Puig');
  expect(screen.getByLabelText(t('onboarding.profile.displayName'))).toHaveDisplayValue('Anna Puig');
});

it('completes the profile and refreshes it so the app opens', async () => {
  const { invalidate } = await renderScreen();
  await fill('Biel', ' Biel ');
  await submit();
  await waitFor(() =>
    expect(rpc).toHaveBeenCalledWith('complete_profile', { username: 'biel', display_name: 'Biel' }),
  );
  await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: myProfileKey }));
});

it('shows "already taken" on the username when someone took it meanwhile', async () => {
  rpc.mockImplementation(async (fn: string) =>
    fn === 'username_available'
      ? { data: true, error: null }
      : { data: null, error: { code: 'P0001', message: 'username_taken' } },
  );
  await renderScreen();
  await fill('biel', 'Biel');
  await submit();
  expect(await screen.findByText(t('onboarding.profile.usernameTaken'))).toBeOnTheScreen();
});

it('requires a display name', async () => {
  await renderScreen();
  await fill('biel', '   ');
  await submit();
  expect(await screen.findByText(t('onboarding.profile.displayNameRequired'))).toBeOnTheScreen();
  expect(rpc).not.toHaveBeenCalledWith('complete_profile', expect.anything());
});
