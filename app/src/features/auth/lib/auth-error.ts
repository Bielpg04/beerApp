/** Error from an auth call, carrying Supabase's machine-readable code (e.g. "otp_expired"). */
export class AuthError extends Error {
  readonly code: string;

  constructor(code: string | undefined, message?: string) {
    super(message ?? code ?? 'auth_error');
    this.name = 'AuthError';
    this.code = code ?? 'unknown';
  }
}

export function throwIfError(error: { code?: string; message?: string } | null): void {
  if (error) throw new AuthError(error.code, error.message);
}

export type AuthErrorKey =
  | 'auth.errors.codeExpired'
  | 'auth.errors.tooManyEmails'
  | 'auth.errors.invalidEmail'
  | 'auth.errors.generic';

const KEYS: Record<string, AuthErrorKey> = {
  otp_expired: 'auth.errors.codeExpired',
  over_email_send_rate_limit: 'auth.errors.tooManyEmails',
  over_request_rate_limit: 'auth.errors.tooManyEmails',
  email_address_invalid: 'auth.errors.invalidEmail',
};

/** Translation key for an auth failure; unknown errors get a generic message. */
export function authErrorKey(error: unknown): AuthErrorKey {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  return KEYS[code] ?? 'auth.errors.generic';
}
