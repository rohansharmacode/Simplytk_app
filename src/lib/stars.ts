import { useSyncExternalStore } from 'react';

import { syncPushToken } from '@/lib/push';
import { fetchStarred, star, unstar, type Opening } from '@/lib/tracker/queries';

/**
 * The student's starred openings, shared by Home, the Tracker and the opening screen so a
 * star shows everywhere at once. Toggles are optimistic and roll back if the save fails.
 */
type State = { list: Opening[] | null; error: string | null };

let state: State = { list: null, error: null };
const listeners = new Set<() => void>();

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useStars(): State {
  return useSyncExternalStore(subscribe, () => state);
}

export function useIsStarred(id: string): boolean {
  return useSyncExternalStore(subscribe, () => state.list?.some((o) => o.id === id) ?? false);
}

export async function loadStars() {
  try {
    set({ list: await fetchStarred(), error: null });
  } catch (error) {
    set({ error: error instanceof Error ? error.message : String(error) });
  }
}

export function clearStars() {
  set({ list: null, error: null });
}

let askedForPush = false;

export async function toggleStar(opening: Opening) {
  const before = state.list ?? [];
  const starred = before.some((o) => o.id === opening.id);
  set({ list: starred ? before.filter((o) => o.id !== opening.id) : [opening, ...before] });
  try {
    if (starred) {
      await unstar(opening.id);
    } else {
      await star(opening.id);
      // Alerts for starred openings are the point of the app, so the first star is the
      // moment to ask for notifications.
      if (!askedForPush) {
        askedForPush = true;
        void syncPushToken({ ask: true });
      }
    }
  } catch (error) {
    set({ list: before, error: error instanceof Error ? error.message : String(error) });
  }
}
