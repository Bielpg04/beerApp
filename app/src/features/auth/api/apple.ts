import { Platform } from 'react-native';

import { supabase } from '@/shared/lib/supabase';

import { throwIfError } from '../lib/auth-error';

type AppleModule = typeof import('expo-apple-authentication');
type CryptoModule = typeof import('expo-crypto');

// Loaded on demand: the native module only exists on iOS builds.
/* eslint-disable @typescript-eslint/no-require-imports */
const appleModule = () => require('expo-apple-authentication') as AppleModule;
const cryptoModule = () => require('expo-crypto') as CryptoModule;
/* eslint-enable @typescript-eslint/no-require-imports */

export interface AppleOptions {
  /** EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED=true once the Apple Developer account and Supabase provider exist. */
  enabled?: boolean;
  platform?: string;
}

export async function isAppleAvailable({
  enabled = process.env.EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED === 'true',
  platform = Platform.OS,
}: AppleOptions = {}): Promise<boolean> {
  if (platform !== 'ios' || !enabled) return false;
  return appleModule().isAvailableAsync();
}

/**
 * Native Sign in with Apple → Supabase session. Apple sends the user's name only the first
 * time, so it is stored in the auth metadata and in the profile if that has no name yet.
 */
export async function signInWithApple(): Promise<'ok' | 'cancelled'> {
  const { signInAsync, AppleAuthenticationScope } = appleModule();
  const { randomUUID, digestStringAsync, CryptoDigestAlgorithm } = cryptoModule();
  const nonce = randomUUID();
  const hashedNonce = await digestStringAsync(CryptoDigestAlgorithm.SHA256, nonce);

  let credential: Awaited<ReturnType<AppleModule['signInAsync']>>;
  try {
    credential = await signInAsync({
      requestedScopes: [AppleAuthenticationScope.FULL_NAME, AppleAuthenticationScope.EMAIL],
      nonce: hashedNonce,
    });
  } catch (e) {
    if (typeof e === 'object' && e !== null && 'code' in e && e.code === 'ERR_REQUEST_CANCELED')
      return 'cancelled';
    throw e;
  }
  if (!credential.identityToken) throw new Error('missing_identity_token');

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce,
  });
  throwIfError(error);

  const name = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ');
  if (name && data.user) {
    await supabase.auth.updateUser({ data: { full_name: name } });
    await supabase
      .from('profiles')
      .update({ display_name: name })
      .eq('id', data.user.id)
      .is('display_name', null);
  }
  return 'ok';
}
