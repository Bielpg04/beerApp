import { queryClient } from '@/shared/lib/query-client';
import { supabase } from '@/shared/lib/supabase';

import { signOut } from '..';

jest.mock('@/shared/lib/supabase', () => ({
  supabase: { auth: { signOut: jest.fn() } },
}));

const auth = supabase.auth as unknown as { signOut: jest.Mock };

it('signs out and drops all cached data of the previous user', async () => {
  auth.signOut.mockResolvedValue({ error: null });
  queryClient.setQueryData(['profile', 'me'], { id: 'user-1' });

  await signOut();

  expect(auth.signOut).toHaveBeenCalled();
  expect(queryClient.getQueryData(['profile', 'me'])).toBeUndefined();
});
