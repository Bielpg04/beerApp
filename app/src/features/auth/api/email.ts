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

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  queryClient.clear();
  throwIfError(error);
}
