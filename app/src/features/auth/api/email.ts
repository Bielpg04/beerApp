import { queryClient } from '@/shared/lib/query-client';
import { supabase } from '@/shared/lib/supabase';

import { throwIfError } from '../lib/auth-error';

const normalize = (email: string) => email.trim().toLowerCase();

/** Emails a 6-digit sign-in code; creates the account on first use. */
export async function sendEmailCode(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email: normalize(email),
    options: { shouldCreateUser: true },
  });
  throwIfError(error);
}

export async function verifyEmailCode(email: string, code: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ email: normalize(email), token: code, type: 'email' });
  throwIfError(error);
}

/**
 * Ends the session on this device. Local scope removes the stored session even offline
 * (the server-side refresh token simply expires); cached data is cleared only afterwards.
 */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  throwIfError(error);
  queryClient.clear();
}
