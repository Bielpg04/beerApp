import * as AppleAuthentication from 'expo-apple-authentication';

import { supabase } from '@/shared/lib/supabase';

import { isAppleAvailable, signInWithApple } from '..';

jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn(),
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));
jest.mock('expo-crypto', () => ({
  randomUUID: () => 'raw-nonce',
  digestStringAsync: jest.fn(async () => 'hashed-nonce'),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));
const mockIs = jest.fn();
jest.mock('@/shared/lib/supabase', () => ({
  supabase: {
    auth: { signInWithIdToken: jest.fn(), updateUser: jest.fn() },
    from: jest.fn(() => ({ update: () => ({ eq: () => ({ is: mockIs }) }) })),
  },
}));

const apple = AppleAuthentication as jest.Mocked<typeof AppleAuthentication>;
const auth = supabase.auth as unknown as { signInWithIdToken: jest.Mock; updateUser: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
  apple.isAvailableAsync.mockResolvedValue(true);
  auth.signInWithIdToken.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  auth.updateUser.mockResolvedValue({ data: {}, error: null });
  mockIs.mockResolvedValue({ error: null });
});

describe('isAppleAvailable', () => {
  it('is false on Android', async () => {
    expect(await isAppleAvailable({ enabled: true, platform: 'android' })).toBe(false);
  });
  it('is false on iOS until it is enabled for the build', async () => {
    expect(await isAppleAvailable({ enabled: false, platform: 'ios' })).toBe(false);
  });
  it('is true on iOS when enabled and supported by the device', async () => {
    expect(await isAppleAvailable({ enabled: true, platform: 'ios' })).toBe(true);
  });
});

describe('signInWithApple', () => {
  it('signs in with the identity token and the raw nonce, and keeps the name Apple gives only once', async () => {
    apple.signInAsync.mockResolvedValue({
      identityToken: 't',
      fullName: { givenName: 'Anna', familyName: 'Puig' },
    } as never);

    await expect(signInWithApple()).resolves.toBe('ok');

    expect(apple.signInAsync).toHaveBeenCalledWith({ requestedScopes: [0, 1], nonce: 'hashed-nonce' });
    expect(auth.signInWithIdToken).toHaveBeenCalledWith({
      provider: 'apple',
      token: 't',
      nonce: 'raw-nonce',
    });
    expect(auth.updateUser).toHaveBeenCalledWith({ data: { full_name: 'Anna Puig' } });
    expect(mockIs).toHaveBeenCalledWith('display_name', null);
  });

  it('returns "cancelled" when the user dismisses the Apple sheet', async () => {
    apple.signInAsync.mockRejectedValue(
      Object.assign(new Error('canceled'), { code: 'ERR_REQUEST_CANCELED' }),
    );
    await expect(signInWithApple()).resolves.toBe('cancelled');
    expect(auth.signInWithIdToken).not.toHaveBeenCalled();
  });

  it('does not touch the name when Apple does not send it (returning users)', async () => {
    apple.signInAsync.mockResolvedValue({ identityToken: 't', fullName: null } as never);
    await signInWithApple();
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
});
