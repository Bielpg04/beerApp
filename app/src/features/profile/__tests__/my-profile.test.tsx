import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { supabase } from '@/shared/lib/supabase';

import { myProfileKey, useMyProfile, useOwnProfile } from '..';

const maybeSingle = jest.fn();
jest.mock('@/shared/lib/supabase', () => ({
  supabase: { auth: { getSession: jest.fn() }, from: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({
    data: { session: { user: { id: 'user-1' } } },
  });
  (supabase.from as jest.Mock).mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle }) }) });
  maybeSingle.mockResolvedValue({ data: { id: 'user-1', onboarded_at: null }, error: null });
});

it('refetches the own profile after invalidation, also when a screen only reads it', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = await renderHook(() => ({ root: useMyProfile('user-1'), screen: useOwnProfile() }), {
    wrapper,
  });
  await waitFor(() => expect(result.current.root.data?.id).toBe('user-1'));

  maybeSingle.mockResolvedValue({
    data: { id: 'user-1', onboarded_at: '2026-11-13T10:00:00Z' },
    error: null,
  });
  await act(() => client.invalidateQueries({ queryKey: myProfileKey }));

  await waitFor(() => expect(result.current.root.data?.onboarded_at).toBe('2026-11-13T10:00:00Z'));
  expect(result.current.screen.error).toBeNull();
});

it('does not fetch while signed out', async () => {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  await renderHook(() => useMyProfile(null), { wrapper });
  expect(supabase.from).not.toHaveBeenCalled();
});
