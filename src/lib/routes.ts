import { nativeDrillForPath } from './drills/catalogue';
import { sitePathFromUrl } from './site';

/**
 * The tabs follow simplytk.com's own mobile tab bar (Home, Tracker, Progress, More), which
 * the app hides in favour of the native one, with a native Drills tab in place of Explore.
 * These are the tabs that show a site section in a WebView.
 */
export type WebTab = 'index' | 'tracker' | 'progress';

/** The site page each tab opens on. Home is the PWA manifest's start URL. */
export const TAB_HOME: Record<WebTab, string> = {
  index: '/dashboard',
  tracker: '/internship-tracker',
  progress: '/progress',
};

const TAB_ROUTE: Record<WebTab, string> = {
  index: '/',
  tracker: '/tracker',
  progress: '/progress',
};

/** Site sections owned by each tab. Anything else opens as a pushed page over the tabs. */
const TAB_SECTIONS: [prefix: string, tab: WebTab][] = [
  ['/dashboard', 'index'],
  ['/internship-tracker', 'tracker'],
  ['/live', 'tracker'],
  ['/expected-openings', 'tracker'],
  ['/companies', 'tracker'],
  ['/progress', 'progress'],
];

/** Routes that exist in the app itself (src/app). */
const APP_ROUTES = ['/', '/drills', '/tracker', '/progress', '/more', '/page'];

function isAppRoute(pathname: string) {
  const play = /^\/play\/([^/]+)$/.exec(pathname);
  return APP_ROUTES.includes(pathname) || (play !== null && !!nativeDrillForPath(play[1]));
}

const SCHEME = 'simplytk:';

function pathnameOf(path: string) {
  return path.split(/[?#]/, 1)[0] || '/';
}

export function tabForSitePath(path: string): WebTab | null {
  const pathname = pathnameOf(path);
  for (const [prefix, tab] of TAB_SECTIONS) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return tab;
  }
  return null;
}

/**
 * App href that shows a simplytk.com path: the native drill if the app has one, inside its
 * tab when one owns it, else as a page.
 */
export function hrefForSitePath(path: string): string {
  const sitePath = path.startsWith('/') ? path : `/${path}`;
  if (pathnameOf(sitePath) === '/') return '/';
  const drill = nativeDrillForPath(pathnameOf(sitePath));
  if (drill) return `/play/${drill.slug}`;
  const tab = tabForSitePath(sitePath);
  const route = tab ? TAB_ROUTE[tab] : '/page';
  return `${route}?path=${encodeURIComponent(sitePath)}`;
}

/**
 * Map anything the OS or a notification hands the app to an app href:
 *   https://simplytk.com/companies/jane-street  -> /tracker?path=%2Fcompanies%2Fjane-street
 *   simplytk://cv-rater                          -> /page?path=%2Fcv-rater
 *   /more                                        -> /more (already an app route)
 * Unknown input falls back to the home tab rather than an unmatched-route screen.
 */
export function hrefForIncomingUrl(input: string): string {
  const raw = input.trim();
  if (!raw) return '/';

  if (/^https?:\/\//i.test(raw)) {
    const sitePath = sitePathFromUrl(raw);
    return sitePath ? hrefForSitePath(sitePath) : '/';
  }

  let path = raw;
  if (raw.toLowerCase().startsWith(SCHEME)) {
    // simplytk://cv-rater?x=1 and simplytk:///cv-rater both mean the path /cv-rater?x=1.
    path = `/${raw.slice(SCHEME.length).replace(/^\/+/, '')}`;
  }
  if (!path.startsWith('/')) return '/';

  if (isAppRoute(pathnameOf(path))) return path;
  return hrefForSitePath(path);
}

/** The `url` (or `path`) field of a push notification's data payload, as an app href. */
export function hrefForNotificationData(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const { url, path } = data as { url?: unknown; path?: unknown };
  const target = typeof url === 'string' ? url : typeof path === 'string' ? path : null;
  return target ? hrefForIncomingUrl(target) : null;
}
