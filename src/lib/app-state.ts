import { useSyncExternalStore } from 'react';

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

let state: SiteState = { dark: null, signedIn: null };
const listeners = new Set<() => void>();

export function getSiteState(): SiteState {
  return state;
}

export function updateSiteState(patch: Partial<SiteState>) {
  const next = { ...state, ...patch };
  if (next.dark === state.dark && next.signedIn === state.signedIn) return;
  state = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSiteState(): SiteState {
  return useSyncExternalStore(subscribe, getSiteState);
}
