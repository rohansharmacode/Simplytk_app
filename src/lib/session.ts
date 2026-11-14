import { useEffect, useSyncExternalStore } from 'react';

import { supabase, type Session } from '@/lib/supabase';

/**
 * The signed-in student, shared by every screen. `undefined` until the stored session has
 * been read at launch, then a session or `null`.
 */
type State = { session: Session | null | undefined };

let state: State = { session: undefined };
const listeners = new Set<() => void>();

function set(session: Session | null) {
  if (state.session === session) return;
  state = { session };
  listeners.forEach((listener) => listener());
}

let started = false;

/** Read the stored session and follow sign-ins, sign-outs and token refreshes. */
export function startSession() {
  if (started) return;
  started = true;
  supabase.auth
    .getSession()
    .then(({ data }) => set(data.session))
    .catch(() => set(null));
  supabase.auth.onAuthStateChange((_event, session) => set(session));
}

export function getSession(): Session | null {
  return state.session ?? null;
}

export function useSession(): Session | null | undefined {
  useEffect(startSession, []);
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => state.session,
  );
}

/** For tests: start from a known session without touching storage. */
export function setSessionForTests(session: Session | null) {
  started = true;
  set(session);
}

export async function signOut() {
  // The token is removed while the request can still say whose it is.
  const { forgetPushToken } = await import('@/lib/push');
  await forgetPushToken();
  await supabase.auth.signOut().catch(() => {});
  set(null);
}
