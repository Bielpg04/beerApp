import type { MyProfile } from '@/features/profile';

import type { SessionStatus } from '../hooks/use-session';

export type RouteState = 'loading' | 'signedOut' | 'needsAge' | 'needsProfile' | 'ready';

/** Where the user belongs: login, an onboarding step, or the app. */
export function routeState(
  session: SessionStatus,
  profile: Pick<MyProfile, 'birthdate' | 'onboarded_at'> | null | undefined,
): RouteState {
  if (session === 'loading') return 'loading';
  if (session === 'signedOut') return 'signedOut';
  if (profile === undefined) return 'loading';
  if (!profile?.birthdate) return 'needsAge';
  if (!profile.onboarded_at) return 'needsProfile';
  return 'ready';
}
