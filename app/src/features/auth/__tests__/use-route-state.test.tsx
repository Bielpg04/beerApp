import { renderHook } from '@testing-library/react-native';

import { useMyProfile } from '@/features/profile';

import { useRouteState, useSession } from '..';

jest.mock('../hooks/use-session', () => ({ useSession: jest.fn() }));
jest.mock('@/features/profile', () => ({ useMyProfile: jest.fn() }));

it('combines the session and the profile query', async () => {
  (useSession as jest.Mock).mockReturnValue({ status: 'signedIn', userId: 'u1' });
  (useMyProfile as jest.Mock).mockReturnValue({ data: { birthdate: null, onboarded_at: null } });

  const { result } = await renderHook(() => useRouteState());

  expect(useMyProfile).toHaveBeenCalledWith('u1');
  expect(result.current).toBe('needsAge');
});

it('keeps the last settled state while the profile reloads after signing in', async () => {
  const session = useSession as jest.Mock;
  const myProfile = useMyProfile as jest.Mock;

  session.mockReturnValue({ status: 'signedOut', userId: null });
  myProfile.mockReturnValue({ data: undefined });
  const { result, rerender } = await renderHook(() => useRouteState());
  expect(result.current).toBe('signedOut');

  session.mockReturnValue({ status: 'signedIn', userId: 'u1' }); // profile still loading
  await rerender({});
  expect(result.current).toBe('signedOut');

  myProfile.mockReturnValue({ data: { birthdate: null, onboarded_at: null } });
  await rerender({});
  expect(result.current).toBe('needsAge');
});

it('reports loading only before anything has settled', async () => {
  (useSession as jest.Mock).mockReturnValue({ status: 'loading', userId: null });
  const { result } = await renderHook(() => useRouteState());
  expect(result.current).toBe('loading');
});
