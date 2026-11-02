import { useSyncExternalStore } from 'react';

import { getDaily, getLeague, getStreak, SiteApiMissing, type DailyState, type League, type Streak } from '@/lib/site-api';

/**
 * Today's challenge, the streak and the league place, shared by Home and the Daily tab and
 * refreshed when a run is submitted. `missing` is set while the website does not serve the
 * app endpoints yet, so screens can offer the web page instead.
 */
type State = {
  daily: DailyState | null;
  streak: Streak | null;
  league: League | null;
  missing: boolean;
  error: string | null;
  loaded: boolean;
};

const initial: State = { daily: null, streak: null, league: null, missing: false, error: null, loaded: false };
let state = initial;
const listeners = new Set<() => void>();

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

export function useDaily(): State {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => state,
  );
}

function settle<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === 'fulfilled' ? result.value : null;
}

export async function refreshDaily() {
  const [daily, streak, league] = await Promise.allSettled([getDaily(), getStreak(), getLeague()]);
  const failures = [daily, streak, league].filter((r): r is PromiseRejectedResult => r.status === 'rejected');
  const missing = failures.some((r) => r.reason instanceof SiteApiMissing);
  const firstError = failures.find((r) => !(r.reason instanceof SiteApiMissing));
  set({
    daily: settle(daily) ?? state.daily,
    streak: settle(streak) ?? state.streak,
    league: settle(league) ?? state.league,
    missing,
    error: firstError ? String(firstError.reason instanceof Error ? firstError.reason.message : firstError.reason) : null,
    loaded: true,
  });
}

export function clearDaily() {
  state = initial;
  listeners.forEach((listener) => listener());
}
