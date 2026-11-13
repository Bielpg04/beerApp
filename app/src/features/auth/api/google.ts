import { Platform } from 'react-native';

import { supabase } from '@/shared/lib/supabase';

import { throwIfError } from '../lib/auth-error';

type GoogleSignInModule = typeof import('@react-native-google-signin/google-signin');

export interface GoogleConfig {
  webClientId?: string;
  iosClientId?: string;
}

/** OAuth client ids from the build environment (set per EAS environment). */
export const googleConfigFromEnv = (): GoogleConfig => ({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
});

/** Native Google sign-in needs the web client id, plus the iOS one on iOS. Not offered on web. */
export function isGoogleConfigured(config: GoogleConfig, platform: string = Platform.OS): boolean {
  if (platform !== 'ios' && platform !== 'android') return false;
  return Boolean(config.webClientId) && (platform !== 'ios' || Boolean(config.iosClientId));
}

const hasCode = (e: unknown, codes: string[]) =>
  typeof e === 'object' && e !== null && 'code' in e && codes.includes(String(e.code));

/** Shows Google's native account picker and signs into Supabase with the returned ID token. */
export async function signInWithGoogle(
  config: GoogleConfig = googleConfigFromEnv(),
): Promise<'ok' | 'cancelled'> {
  // Loaded on demand: the native module doesn't exist in Expo Go or on web, and importing it
  // eagerly would crash the whole app there.
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy native module
  const { GoogleSignin, statusCodes } =
    require('@react-native-google-signin/google-signin') as GoogleSignInModule;
  GoogleSignin.configure({ webClientId: config.webClientId, iosClientId: config.iosClientId });
  try {
    if (Platform.OS === 'android') await GoogleSignin.hasPlayServices();
    const response = await GoogleSignin.signIn();
    if (response.type === 'cancelled') return 'cancelled';
    const token = response.data.idToken;
    if (!token) throw new Error('missing_id_token');
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token });
    throwIfError(error);
    return 'ok';
  } catch (e) {
    if (hasCode(e, [statusCodes.SIGN_IN_CANCELLED, statusCodes.IN_PROGRESS])) return 'cancelled';
    throw e;
  }
}
