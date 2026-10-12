/**
 * The contract between simplytk.com and the native app. Every page loaded in the app gets:
 *
 *   window.SimplytkNative = {
 *     platform: 'ios' | 'android',
 *     appVersion: '1.0.0',
 *     requestPushToken(): Promise<
 *       | { status: 'granted', token: 'ExponentPushToken[...]' }
 *       | { status: 'denied' }
 *       | { status: 'unavailable', reason: string }
 *     >,
 *     share({ title, text, url }): Promise<void>,
 *   }
 *
 * plus `simplytk-native-app` and `simplytk-native-ios|android` classes on <html> for
 * app-only CSS, a native-backed `navigator.share` where the WebView lacks one (Android),
 * and the site's own mobile tab bar hidden (APP_CSS). The app listens for `state`
 * messages to keep its tab bar theme and the other tabs' sign-in state in step.
 *
 * docs/web-integration.md describes this from the website's side.
 */

export type BridgeMessage =
  | { type: 'state'; dark: boolean; signedIn: boolean; title: string }
  | { type: 'share'; title?: string; text?: string; url?: string }
  | { type: 'push:request'; id: number };

/**
 * simplytk.com's mobile tab bar (`<nav aria-label="Primary" class="fixed … bottom-0">`) and
 * the body padding reserved for it. The site can do this itself with the
 * `html.simplytk-native-app` class, at which point this becomes a no-op.
 */
export const APP_CSS =
  'nav[aria-label="Primary"].fixed.bottom-0{display:none!important}' +
  'body{padding-bottom:0!important}';

type BridgeConfig = {
  platform: string;
  appVersion: string;
  siteHosts: string[];
};

/** Injected before any page script runs, in the main frame only. */
export function bridgeScript(config: BridgeConfig): string {
  return `(function () {
  if (window.SimplytkNative) return;
  var config = ${JSON.stringify(config)};
  var onSite = config.siteHosts.indexOf(location.hostname) !== -1;

  function post(message) {
    try { window.ReactNativeWebView.postMessage(JSON.stringify(message)); } catch (e) {}
  }

  // First launch in the app follows the phone's light/dark setting rather than the
  // site's light default. The site's own theme switch still wins once used.
  if (onSite) {
    try {
      if (!localStorage.getItem('simplytk-theme')) localStorage.setItem('simplytk-theme', 'system');
    } catch (e) {}
  }

  var pending = {};
  var nextId = 1;
  function request(type) {
    return new Promise(function (resolve) {
      var id = nextId++;
      pending[id] = resolve;
      post({ type: type, id: id });
    });
  }
  Object.defineProperty(window, '__simplytkNativeReply', {
    value: function (id, result) {
      var resolve = pending[id];
      if (!resolve) return;
      delete pending[id];
      resolve(result);
    },
  });

  function share(data) {
    data = data || {};
    post({ type: 'share', title: data.title, text: data.text, url: data.url });
    return Promise.resolve();
  }

  window.SimplytkNative = Object.freeze({
    platform: config.platform,
    appVersion: config.appVersion,
    requestPushToken: function () { return request('push:request'); },
    share: share,
  });

  if (typeof navigator.share !== 'function') {
    try {
      navigator.share = share;
      navigator.canShare = function (data) { return !!data && !data.files; };
    } catch (e) {}
  }

  if (!onSite) return;

  // The site has its own mobile tab bar; inside the app the native one replaces it.
  // Added as soon as <head> exists so the web bar never flashes up.
  function addStyle() {
    if (!document.head) return false;
    var style = document.createElement('style');
    style.setAttribute('data-simplytk-native', '');
    style.textContent = ${JSON.stringify(APP_CSS)};
    document.head.appendChild(style);
    return true;
  }
  if (!addStyle()) {
    var waitForHead = new MutationObserver(function () {
      if (addStyle()) waitForHead.disconnect();
    });
    waitForHead.observe(document, { childList: true, subtree: true });
  }

  var last = '';
  function report() {
    var root = document.documentElement;
    if (!root) return;
    var signedIn = false;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        if (/^sb-.+-auth-token$/.test(localStorage.key(i) || '')) { signedIn = true; break; }
      }
    } catch (e) {}
    var message = {
      type: 'state',
      dark: root.classList.contains('dark'),
      signedIn: signedIn,
      title: document.title,
    };
    var serialized = JSON.stringify(message);
    if (serialized === last) return;
    last = serialized;
    post(message);
  }

  function start() {
    document.documentElement.classList.add('simplytk-native-app', 'simplytk-native-' + config.platform);
    report();
    // Theme switches are immediate; sign-in and title changes are picked up by polling,
    // which is just a localStorage key scan.
    new MutationObserver(report).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    setInterval(report, 1000);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
true;`;
}

/** Script that resolves the page's pending `request()` promise with `result`. */
export function replyScript(id: number, result: unknown): string {
  return `window.__simplytkNativeReply && window.__simplytkNativeReply(${JSON.stringify(id)}, ${JSON.stringify(result)}); true;`;
}

/** Script that navigates the page to `url` (used for deep links into an open tab). */
export function navigateScript(url: string): string {
  return `window.location.assign(${JSON.stringify(url)}); true;`;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** Validate a message posted by a page; anything malformed is dropped. */
export function parseBridgeMessage(raw: string): BridgeMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const message = parsed as Record<string, unknown>;

  switch (message.type) {
    case 'state':
      if (typeof message.dark !== 'boolean' || typeof message.signedIn !== 'boolean') return null;
      return {
        type: 'state',
        dark: message.dark,
        signedIn: message.signedIn,
        title: typeof message.title === 'string' ? message.title : '',
      };
    case 'share': {
      const url = optionalString(message.url);
      const text = optionalString(message.text);
      if (!url && !text) return null;
      return { type: 'share', title: optionalString(message.title), text, url };
    }
    case 'push:request':
      if (typeof message.id !== 'number' || !Number.isInteger(message.id)) return null;
      return { type: 'push:request', id: message.id };
    default:
      return null;
  }
}
