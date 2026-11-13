import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { i18n } from '@/shared/i18n';

import { AuthError, authErrorKey, CodeScreen, LoginScreen } from '..';
import { sendEmailCode, verifyEmailCode } from '../api/email';

jest.mock('../api/email', () => ({
  sendEmailCode: jest.fn(),
  verifyEmailCode: jest.fn(),
  signOut: jest.fn(),
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({ email: 'biel@example.com' }),
}));

const t = (key: string, opts?: Record<string, unknown>) =>
  i18n.t(key as never, opts as never) as unknown as string;
const send = sendEmailCode as jest.Mock;
const verify = verifyEmailCode as jest.Mock;

beforeAll(() => i18n.changeLanguage('ca'));
beforeEach(() => {
  jest.clearAllMocks();
  send.mockResolvedValue(undefined);
  verify.mockResolvedValue(undefined);
});

describe('authErrorKey', () => {
  it.each([
    [{ code: 'otp_expired' }, 'auth.errors.codeExpired'],
    [{ code: 'over_email_send_rate_limit' }, 'auth.errors.tooManyEmails'],
    [{ code: 'email_address_invalid' }, 'auth.errors.invalidEmail'],
    [new AuthError('something_else'), 'auth.errors.generic'],
    [new Error('network'), 'auth.errors.generic'],
    [undefined, 'auth.errors.generic'],
  ])('%j → %s', (error, key) => {
    expect(authErrorKey(error)).toBe(key);
  });
});

describe('LoginScreen', () => {
  it('rejects an invalid email without sending a code', async () => {
    await render(<LoginScreen />);
    await fireEvent.changeText(screen.getByLabelText(t('auth.login.emailLabel')), 'biel@');
    await fireEvent.press(screen.getByRole('button', { name: t('auth.login.submit') }));
    expect(await screen.findByText(t('auth.errors.invalidEmail'))).toBeOnTheScreen();
    expect(send).not.toHaveBeenCalled();
  });

  it('sends the code and opens the code screen with the email', async () => {
    await render(<LoginScreen />);
    await fireEvent.changeText(screen.getByLabelText(t('auth.login.emailLabel')), ' Biel@Example.com ');
    await fireEvent.press(screen.getByRole('button', { name: t('auth.login.submit') }));
    await waitFor(() => expect(send).toHaveBeenCalledWith('biel@example.com'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/code', params: { email: 'biel@example.com' } });
  });

  it('shows a translated error when sending fails', async () => {
    send.mockRejectedValue(new AuthError('over_email_send_rate_limit'));
    await render(<LoginScreen />);
    await fireEvent.changeText(screen.getByLabelText(t('auth.login.emailLabel')), 'biel@example.com');
    await fireEvent.press(screen.getByRole('button', { name: t('auth.login.submit') }));
    expect(await screen.findByText(t('auth.errors.tooManyEmails'))).toBeOnTheScreen();
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe('CodeScreen', () => {
  afterEach(() => jest.useRealTimers());

  const enterCode = async (code: string) => {
    await fireEvent.changeText(screen.getByLabelText(t('auth.code.codeLabel')), code);
    await fireEvent.press(screen.getByRole('button', { name: t('auth.code.submit') }));
  };

  it('verifies a 6-digit code for the email from the route', async () => {
    await render(<CodeScreen />);
    await enterCode('123456');
    await waitFor(() => expect(verify).toHaveBeenCalledWith('biel@example.com', '123456'));
  });

  it('does not verify a code that is not 6 digits', async () => {
    await render(<CodeScreen />);
    await enterCode('12345');
    expect(await screen.findByText(t('auth.errors.invalidCode'))).toBeOnTheScreen();
    expect(verify).not.toHaveBeenCalled();
  });

  it('explains an expired code and lets the user resend it after the cooldown', async () => {
    jest.useFakeTimers();
    verify.mockRejectedValue(new AuthError('otp_expired'));
    await render(<CodeScreen />);
    await enterCode('123456');
    expect(await screen.findByText(t('auth.errors.codeExpired'))).toBeOnTheScreen();

    const resend = () => screen.getByRole('button', { name: /^(Reenvia el codi|Pots reenviar-lo)/ });
    expect(resend()).toBeDisabled(); // a code was just sent when the screen opened
    await act(async () => jest.advanceTimersByTime(30_000));
    expect(resend()).toBeEnabled();

    await fireEvent.press(resend());
    await waitFor(() => expect(send).toHaveBeenCalledWith('biel@example.com'));
    expect(resend()).toBeDisabled();
  });
});
