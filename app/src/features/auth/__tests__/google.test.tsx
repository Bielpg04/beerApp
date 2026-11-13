import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { render, screen } from '@testing-library/react-native';

import { i18n } from '@/shared/i18n';
import { supabase } from '@/shared/lib/supabase';

import { isGoogleConfigured, signInWithGoogle, SocialButtons } from '..';

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { configure: jest.fn(), hasPlayServices: jest.fn(), signIn: jest.fn() },
  statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED', IN_PROGRESS: 'IN_PROGRESS' },
}));
jest.mock('@/shared/lib/supabase', () => ({ supabase: { auth: { signInWithIdToken: jest.fn() } } }));

const google = GoogleSignin as unknown as {
  configure: jest.Mock;
  hasPlayServices: jest.Mock;
  signIn: jest.Mock;
};
const signInWithIdToken = supabase.auth.signInWithIdToken as jest.Mock;
const configured = {
  webClientId: 'web.apps.googleusercontent.com',
  iosClientId: 'ios.apps.googleusercontent.com',
};

beforeAll(() => i18n.changeLanguage('ca'));
beforeEach(() => {
  jest.clearAllMocks();
  google.hasPlayServices.mockResolvedValue(true);
  signInWithIdToken.mockResolvedValue({ data: {}, error: null });
});

describe('isGoogleConfigured', () => {
  it('needs the web client id everywhere and the iOS client id on iOS', () => {
    expect(isGoogleConfigured({}, 'android')).toBe(false);
    expect(isGoogleConfigured({ webClientId: 'w' }, 'android')).toBe(true);
    expect(isGoogleConfigured({ webClientId: 'w' }, 'ios')).toBe(false);
    expect(isGoogleConfigured(configured, 'ios')).toBe(true);
    expect(isGoogleConfigured(configured, 'web')).toBe(false); // native sign-in only
  });
});

describe('signInWithGoogle', () => {
  it('exchanges the Google ID token for a Supabase session', async () => {
    google.signIn.mockResolvedValue({ type: 'success', data: { idToken: 't' } });
    await expect(signInWithGoogle(configured)).resolves.toBe('ok');
    expect(google.configure).toHaveBeenCalledWith(configured);
    expect(signInWithIdToken).toHaveBeenCalledWith({ provider: 'google', token: 't' });
  });

  it('returns "cancelled" without error when the user closes the dialog', async () => {
    google.signIn.mockResolvedValue({ type: 'cancelled', data: null });
    await expect(signInWithGoogle(configured)).resolves.toBe('cancelled');
    expect(signInWithIdToken).not.toHaveBeenCalled();
  });

  it('rejects with the Supabase error code', async () => {
    google.signIn.mockResolvedValue({ type: 'success', data: { idToken: 't' } });
    signInWithIdToken.mockResolvedValue({ data: {}, error: { code: 'provider_disabled' } });
    await expect(signInWithGoogle(configured)).rejects.toMatchObject({ code: 'provider_disabled' });
  });
});

describe('SocialButtons', () => {
  it('renders nothing when no provider is configured', async () => {
    await render(<SocialButtons google={{}} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
