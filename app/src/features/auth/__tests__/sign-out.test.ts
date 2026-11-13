import { queryClient } from '@/shared/lib/query-client';
import { supabase } from '@/shared/lib/supabase';

import { signOut } from '..';

jest.mock('@/shared/lib/supabase', () => ({
  supabase: { auth: { signOut: jest.fn() } },
}));

const auth = supabase.auth as unknown as { signOut: jest.Mock };

beforeEach(() => queryClient.setQueryData(['profile', 'me'], { id: 'user-1' }));

it('signs out locally (works offline) and drops all cached data of the previous user', async () => {
  auth.signOut.mockResolvedValue({ error: null });

  await signOut();

  expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  expect(queryClient.getQueryData(['profile', 'me'])).toBeUndefined();
});

it('keeps the cached data when signing out fails', async () => {
  auth.signOut.mockResolvedValue({ error: { code: 'unexpected_failure' } });

  await expect(signOut()).rejects.toMatchObject({ code: 'unexpected_failure' });
  expect(queryClient.getQueryData(['profile', 'me'])).toEqual({ id: 'user-1' });
});
