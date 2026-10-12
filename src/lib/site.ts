/** Where the web app lives. Every tab and page in the app is a view onto this origin. */
export const SITE_ORIGIN = 'https://simplytk.com';

export const SITE_HOSTS = ['simplytk.com', 'www.simplytk.com'];

/**
 * Third-party hosts that must stay inside the app's WebView: Supabase (auth redirects),
 * Stripe (embedded payment iframes, 3-D Secure) and bot challenges. On Android every
 * iframe navigation is reported as a top-frame one, so these can't be sent to the browser.
 */
const IN_APP_HOST_SUFFIXES = [
  'supabase.co',
  'stripe.com',
  'stripe.network',
  'hcaptcha.com',
  'challenges.cloudflare.com',
];

/** Hosts owned by another app; the OS hands these to WhatsApp, the App Store, etc. */
const SYSTEM_HOSTS = [
  'wa.me',
  'api.whatsapp.com',
  'chat.whatsapp.com',
  'whatsapp.com',
  'www.whatsapp.com',
  'apps.apple.com',
  'play.google.com',
];

/** Schemes that the WebView handles itself (blank iframes, generated downloads). */
const WEBVIEW_SCHEMES = ['about:', 'blob:', 'data:'];

export type LinkAction =
  /** Load inside the app's WebView. */
  | 'webview'
  /** Open in the in-app browser sheet (SFSafariViewController / Custom Tabs). */
  | 'browser'
  /** Hand to the OS: mail, phone, WhatsApp, store links. */
  | 'system'
  /** Unparseable or unsafe; drop it. */
  | 'block';

function parse(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function hostMatches(host: string, suffix: string) {
  return host === suffix || host.endsWith(`.${suffix}`);
}

export function isSiteUrl(url: string): boolean {
  const parsed = parse(url);
  return (
    !!parsed &&
    (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
    SITE_HOSTS.includes(parsed.hostname.toLowerCase())
  );
}

/** Decide where a navigation to `url` should go. */
export function classifyUrl(url: string): LinkAction {
  const parsed = parse(url);
  if (!parsed) return 'block';

  const protocol = parsed.protocol.toLowerCase();
  if (WEBVIEW_SCHEMES.includes(protocol)) return 'webview';
  if (protocol === 'javascript:' || protocol === 'file:') return 'block';
  if (protocol !== 'http:' && protocol !== 'https:') return 'system';

  const host = parsed.hostname.toLowerCase();
  if (SITE_HOSTS.includes(host)) return 'webview';
  if (IN_APP_HOST_SUFFIXES.some((suffix) => hostMatches(host, suffix))) return 'webview';
  if (SYSTEM_HOSTS.includes(host)) return 'system';
  return 'browser';
}

/** Absolute simplytk.com URL for a site path such as `/internship-tracker?sector=law`. */
export function siteUrl(path: string): string {
  const normalised = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_ORIGIN}${normalised}`;
}

/** `/path?query#hash` for a simplytk.com URL, or null for any other URL. */
export function sitePathFromUrl(url: string): string | null {
  if (!isSiteUrl(url)) return null;
  const parsed = new URL(url);
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

/** Tag first-party entry points the same way the PWA manifest does (`?source=pwa`). */
export function withAppSource(path: string): string {
  return `${path}${path.includes('?') ? '&' : '?'}source=app`;
}

/**
 * Turn a document title such as "CV rater · simplytk" or "simplytk · Live tracker"
 * into a short header title.
 */
export function cleanTitle(title: string | null | undefined): string {
  if (!title) return '';
  const parts = title
    .split(/\s+[·|–—]\s+/)
    .map((part) => part.trim())
    .filter((part) => part && part.toLowerCase() !== 'simplytk');
  return parts[0] ?? '';
}

/**
 * Load failures that are not really failures: navigations we cancelled ourselves
 * (returning false from onShouldStartLoadWithRequest, a newer navigation replacing an
 * older one) and media handed off to the system player.
 */
export function isIgnorableLoadError(error: { domain?: string; code: number }): boolean {
  if (error.domain === 'NSURLErrorDomain' && error.code === -999) return true;
  if (error.domain === 'WebKitErrorDomain' && (error.code === 102 || error.code === 204)) {
    return true;
  }
  return false;
}
