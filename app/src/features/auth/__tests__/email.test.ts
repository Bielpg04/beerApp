import { supabase } from '@/shared/lib/supabase';

import { codeSchema, emailSchema, sendEmailCode, verifyEmailCode } from '..';

jest.mock('@/shared/lib/supabase', () => ({
  supabase: { auth: { signInWithOtp: jest.fn(), verifyOtp: jest.fn() } },
}));

const auth = supabase.auth as unknown as { signInWithOtp: jest.Mock; verifyOtp: jest.Mock };

beforeEach(() => {
  auth.signInWithOtp.mockResolvedValue({ data: {}, error: null });
  auth.verifyOtp.mockResolvedValue({ data: {}, error: null });
});

describe('sendEmailCode', () => {
  it('sends the code to the trimmed, lower-cased email and creates the user if needed', async () => {
    await sendEmailCode('  Biel@Example.com ');
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'biel@example.com',
      options: { shouldCreateUser: true },
    });
  });

  it('rejects with the Supabase error code', async () => {
    auth.signInWithOtp.mockResolvedValue({ data: {}, error: { code: 'over_email_send_rate_limit' } });
    await expect(sendEmailCode('biel@example.com')).rejects.toMatchObject({
      code: 'over_email_send_rate_limit',
    });
  });
});

describe('verifyEmailCode', () => {
  it('verifies the 6-digit code as an email OTP', async () => {
    await verifyEmailCode('biel@example.com', '123456');
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      email: 'biel@example.com',
      token: '123456',
      type: 'email',
    });
  });

  it('rejects with the Supabase error code', async () => {
    auth.verifyOtp.mockResolvedValue({ data: {}, error: { code: 'otp_expired' } });
    await expect(verifyEmailCode('biel@example.com', '123456')).rejects.toMatchObject({
      code: 'otp_expired',
    });
  });
});

describe('schemas', () => {
  it.each([
    ['12345', false],
    ['123456', true],
    ['12a456', false],
    ['1234567', false],
  ])('codeSchema(%j) valid = %s', (code, valid) => {
    expect(codeSchema.safeParse(code).success).toBe(valid);
  });

  it.each([
    ['biel@example.com', true],
    ['  biel@example.com ', true],
    ['biel@', false],
    ['', false],
  ])('emailSchema(%j) valid = %s', (email, valid) => {
    expect(emailSchema.safeParse(email).success).toBe(valid);
  });
});
