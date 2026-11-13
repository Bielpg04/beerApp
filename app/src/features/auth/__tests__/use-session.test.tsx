import { act, renderHook } from '@testing-library/react-native';

import { supabase } from '@/shared/lib/supabase';

import { useSession } from '..';

jest.mock('@/shared/lib/supabase', () => ({
  supabase: { auth: { getSession: jest.fn(), onAuthStateChange: jest.fn() } },
}));

const auth = supabase.auth as unknown as { getSession: jest.Mock; onAuthStateChange: jest.Mock };
type Listener = (event: string, session: { user: { id: string } } | null) => void;

describe('useSession', () => {
  let listener: Listener;
  const unsubscribe = jest.fn();

  beforeEach(() => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    auth.onAuthStateChange.mockImplementation((cb: Listener) => {
      listener = cb;
      return { data: { subscription: { unsubscribe } } };
    });
  });

  it('starts loading and becomes signedOut without a stored session', async () => {
    const { result } = await renderHook(() => useSession());
    expect(result.current).toEqual({ status: 'signedOut', userId: null });
  });

  it('becomes signedIn with the user id on SIGNED_IN', async () => {
    const { result } = await renderHook(() => useSession());
    await act(async () => listener('SIGNED_IN', { user: { id: 'user-1' } }));
    expect(result.current).toEqual({ status: 'signedIn', userId: 'user-1' });
  });

  it('restores a stored session', async () => {
    auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'user-2' } } }, error: null });
    const { result } = await renderHook(() => useSession());
    expect(result.current).toEqual({ status: 'signedIn', userId: 'user-2' });
  });

  it('unsubscribes on unmount', async () => {
    const { unmount } = await renderHook(() => useSession());
    await unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
