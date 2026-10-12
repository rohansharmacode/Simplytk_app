import { useSyncExternalStore } from 'react';

function createStore<T extends object>(initial: T) {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    update(patch: Partial<T>) {
      const next = { ...state, ...patch };
      if ((Object.keys(next) as (keyof T)[]).every((key) => next[key] === state[key])) return;
      state = next;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * State the WebViews report about the site, shared across tabs. Each tab has its own
 * WebView, so when one of them signs in or switches theme the others need to know.
 * `null` means no page has reported yet.
 */
export type SiteState = {
  /** The site's own theme (it can differ from the OS when set in the site's settings). */
  dark: boolean | null;
  signedIn: boolean | null;
};

const siteStore = createStore<SiteState>({ dark: null, signedIn: null });

export const getSiteState = siteStore.get;
export const updateSiteState = siteStore.update;

export function useSiteState(): SiteState {
  return useSyncExternalStore(siteStore.subscribe, siteStore.get);
}

/** Set once the first page has finished loading, so other tabs can load in the background. */
const startupStore = createStore({ firstPageLoaded: false });

export function markFirstPageLoaded() {
  startupStore.update({ firstPageLoaded: true });
}

export function useFirstPageLoaded(): boolean {
  return useSyncExternalStore(startupStore.subscribe, () => startupStore.get().firstPageLoaded);
}
