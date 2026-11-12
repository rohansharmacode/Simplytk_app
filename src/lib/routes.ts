import { nativeDrillForPath } from './drills/catalogue';
import { sitePathFromUrl } from './site';
import { isOpeningId, openingIdFromSlug } from './tracker/openings';

/**
 * The app's tabs are native: Home, Tracker, Daily, Ranks and More. A simplytk.com link
 * opens the native screen that shows the same thing where there is one, and the page in
 * a web view otherwise.
 */

/** Site sections that have a native screen. Longest prefix wins. */
const NATIVE_SECTIONS: [prefix: string, href: string][] = [
  ['/dashboard', '/'],
  ['/dashboard/applications', '/applications'],
  ['/internship-tracker', '/tracker'],
  ['/pre-uni-tracker', '/tracker?stage=preuni'],
  ['/expected-openings', '/opening-soon'],
  ['/live', '/live'],
  ['/opportunities', '/opportunities'],
  ['/progress', '/progress'],
  ['/1v1', '/duels'],
  ['/oa-prep', '/oa-prep'],
  ['/interview-course', '/course'],
  ['/daily', '/daily'],
  ['/oa-leaderboard', '/ranks'],
  ['/league', '/ranks?board=league'],
];

/** Pages under a native section that are still web pages, e.g. account settings. */
const WEB_UNDER_NATIVE = ['/dashboard/'];

/** Native sections that win over WEB_UNDER_NATIVE. */
const NATIVE_UNDER_WEB = ['/dashboard/applications'];

/** Routes that exist in the app itself (src/app). */
const APP_ROUTES = [
  '/',
  '/tracker',
  '/daily',
  '/ranks',
  '/more',
  '/drills',
  '/page',
  '/challenge',
  '/sign-in',
  '/applications',
  '/opening-soon',
  '/live',
  '/opportunities',
  '/progress',
  '/duels',
  '/oa-prep',
  '/course',
];

function isAppRoute(pathname: string) {
  const play = /^\/play\/([^/]+)$/.exec(pathname);
  if (play) return !!nativeDrillForPath(play[1]);
  const opening = /^\/opening\/([^/]+)$/.exec(pathname);
  if (opening) return isOpeningId(opening[1]);
  if (/^\/duels\/[a-z0-9]{6,12}$/i.test(pathname)) return true;
  if (/^\/course\/[a-z0-9-]+$/i.test(pathname)) return true;
  return APP_ROUTES.includes(pathname);
}

const SCHEME = 'simplytk:';

function pathnameOf(path: string) {
  return path.split(/[?#]/, 1)[0] || '/';
}

function nativeHrefFor(pathname: string): string | null {
  const opening = /^\/openings\/([^/]+)$/.exec(pathname);
  if (opening) {
    const id = openingIdFromSlug(opening[1]);
    if (id) return `/opening/${id}`;
  }
  const duel = /^\/1v1\/([a-z0-9]{6,12})$/i.exec(pathname);
  if (duel) return `/duels/${duel[1].toLowerCase()}`;
  const native = NATIVE_UNDER_WEB.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (!native && WEB_UNDER_NATIVE.some((prefix) => pathname.startsWith(prefix))) return null;
  // Longest prefix wins, so /dashboard/applications beats /dashboard.
  let best: [prefix: string, href: string] | null = null;
  for (const entry of NATIVE_SECTIONS) {
    const [prefix] = entry;
    if ((pathname === prefix || pathname.startsWith(`${prefix}/`)) && (!best || prefix.length > best[0].length)) best = entry;
  }
  return best ? best[1] : null;
}

/**
 * App href that shows a simplytk.com path: a native screen or drill if the app has one,
 * else the page in a web view.
 */
export function hrefForSitePath(path: string): string {
  const sitePath = path.startsWith('/') ? path : `/${path}`;
  const pathname = pathnameOf(sitePath);
  if (pathname === '/') return '/';
  const drill = nativeDrillForPath(pathname);
  if (drill) return `/play/${drill.slug}`;
  return nativeHrefFor(pathname) ?? `/page?path=${encodeURIComponent(sitePath)}`;
}

/**
 * Map anything the OS or a notification hands the app to an app href:
 *   https://simplytk.com/internship-tracker      -> /tracker
 *   https://simplytk.com/openings/gs-ib-<id>      -> /opening/<id>
 *   simplytk://cv-rater                           -> /page?path=%2Fcv-rater
 *   /more                                         -> /more (already an app route)
 * Unknown input falls back to Home rather than an unmatched-route screen.
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

/**
 * Where a tapped notification goes. Opening alerts carry the opening's `jobId` and open it
 * with its apply link; anything else carries a simplytk.com `url` (or `path`). An alert
 * whose only link is a firm's own application page opens the tracker.
 */
export function hrefForNotificationData(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const { jobId, url, path } = data as { jobId?: unknown; url?: unknown; path?: unknown };
  if (typeof jobId === 'string' && isOpeningId(jobId)) return `/opening/${jobId.toLowerCase()}`;
  const target = typeof url === 'string' ? url : typeof path === 'string' ? path : null;
  if (!target) return null;
  if (/^https?:\/\//i.test(target) && !sitePathFromUrl(target)) return '/tracker';
  return hrefForIncomingUrl(target);
}
