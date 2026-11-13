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
