import { readEnv } from '../env';

describe('readEnv', () => {
  it('returns the Supabase config', () => {
    expect(
      readEnv({
        EXPO_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
        EXPO_PUBLIC_SUPABASE_KEY: 'sb_publishable_x',
      }),
    ).toEqual({ supabaseUrl: 'http://localhost:54321', supabaseKey: 'sb_publishable_x' });
  });

  it('lists every missing variable', () => {
    expect(() => readEnv({})).toThrow('EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_KEY');
  });
});
