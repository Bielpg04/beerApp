import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { i18n } from '@/shared/i18n';
import { supabase } from '@/shared/lib/supabase';

import { UsernameField } from '..';

jest.mock('@/shared/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));
const rpc = supabase.rpc as jest.Mock;
const t = (key: string) => i18n.t(key as never) as unknown as string;

function Harness() {
  const [value, setValue] = useState('');
  return <UsernameField value={value} onChangeText={setValue} />;
}

async function renderField() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await render(
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>,
  );
}

const input = () => screen.getByLabelText(t('onboarding.profile.username'));

beforeAll(() => i18n.changeLanguage('ca'));
beforeEach(() => {
  jest.useFakeTimers();
  rpc.mockReset();
});
afterEach(() => jest.useRealTimers());

it('checks availability once, 400 ms after the last keystroke, with the normalized name', async () => {
  rpc.mockResolvedValue({ data: true, error: null });
  await renderField();
  for (const text of ['B', 'Bi', 'Bie', 'Biel']) await fireEvent.changeText(input(), text);
  expect(input()).toHaveDisplayValue('biel');

  await act(async () => jest.advanceTimersByTime(399));
  expect(rpc).not.toHaveBeenCalled();
  await act(async () => jest.advanceTimersByTime(1));

  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith('username_available', { candidate: 'biel' });
  expect(await screen.findByText(t('onboarding.profile.usernameAvailable'))).toBeOnTheScreen();
});

it('says when the name is taken', async () => {
  rpc.mockResolvedValue({ data: false, error: null });
  await renderField();
  await fireEvent.changeText(input(), 'pere');
  await act(async () => jest.advanceTimersByTime(400));
  expect(await screen.findByText(t('onboarding.profile.usernameTaken'))).toBeOnTheScreen();
});

it('explains the format instead of asking the server for invalid names', async () => {
  await renderField();
  await fireEvent.changeText(input(), 'ab');
  await act(async () => jest.advanceTimersByTime(400));
  expect(rpc).not.toHaveBeenCalled();
  expect(screen.getByText(t('onboarding.profile.usernameRules'))).toBeOnTheScreen();
});
