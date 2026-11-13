import { useState } from 'react';

import { useMyProfile } from '@/features/profile';

import { routeState, type RouteState } from '../lib/route-state';
import { useSession } from './use-session';

/**
 * Where the user belongs right now. Once something has settled, a transient "loading"
 * (e.g. the profile query right after signing in) keeps the previous state, so the
 * route guards never all switch off at once and lose the navigation. A failed profile load
 * is reported as 'error' so the app can offer a retry instead of waiting forever.
 */
export function useRouteState(): RouteState {
  const session = useSession();
  const profile = useMyProfile(session.userId);
  const state = routeState(session.status, session.userId ? profile.data : undefined, profile.isError);
  const [settled, setSettled] = useState<RouteState>('loading');
  if (state !== 'loading' && state !== 'error' && state !== settled) setSettled(state); // adjust while rendering
  return state === 'loading' ? settled : state;
}
