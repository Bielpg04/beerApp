import { useEffect, useState } from 'react';

import { supabase } from '@/shared/lib/supabase';

export type SessionStatus = 'loading' | 'signedIn' | 'signedOut';

export interface SessionState {
  status: SessionStatus;
  userId: string | null;
}

const fromSession = (session: { user: { id: string } } | null): SessionState =>
  session ? { status: 'signedIn', userId: session.user.id } : { status: 'signedOut', userId: null };

/** Current auth session, restored from storage on start and kept in sync with auth events. */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ status: 'loading', userId: null });

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setState((current) => (current.status === 'loading' ? fromSession(data.session) : current));
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setState(fromSession(session));
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return state;
}
