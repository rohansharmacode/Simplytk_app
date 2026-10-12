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
 *     share({ title, text, url, files }): Promise<void>,
 *   }
 *
 * plus `simplytk-native-app` and `simplytk-native-ios|android` classes on <html> for
 * app-only CSS, a native-backed `navigator.share` where the WebView lacks one (Android),
 * and the site's own mobile tab bar hidden (APP_CSS). On simplytk pages, blob/data
 * downloads and failed clipboard writes are handed to the app, which WebViews can't do
 * themselves. The app listens for `state` messages to keep its tab bar theme and the
 * other tabs' sign-in state in step.
 *
 * docs/web-integration.md describes this from the website's side.
 */

export type BridgeMessage =
  | { type: 'state'; dark: boolean; signedIn: boolean; title: string }
  | { type: 'share'; title?: string; text?: string; url?: string }
  | { type: 'push:request'; id: number }
  | { type: 'copy'; text: string }
  | FileMessage;

/** A file the page tried to download or share, which WebViews can't do themselves. */
export type FileMessage = {
  type: 'file';
  action: 'save' | 'share';
  filename: string;
  mimeType: string;
  base64: string;
  text?: string;
};

/** Larger files are left to the WebView rather than copied through the bridge. */
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

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

  // Files go to the app as base64; it saves them and opens the share sheet.
  function sendFile(blob, filename, action, text) {
    if (!blob || blob.size > ${MAX_FILE_BYTES}) return false;
    var reader = new FileReader();
    reader.onload = function () {
      var result = String(reader.result);
      post({
        type: 'file',
        action: action,
        filename: filename,
        mimeType: blob.type || 'application/octet-stream',
        base64: result.slice(result.indexOf(',') + 1),
        text: text,
      });
    };
    reader.readAsDataURL(blob);
    return true;
  }

  function share(data) {
    data = data || {};
    var file = data.files && data.files[0];
    if (file) {
      return sendFile(file, file.name || 'shared-file', 'share', data.text)
        ? Promise.resolve()
        : Promise.reject(new Error('File too large to share'));
    }
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
      navigator.canShare = function (data) {
        return !!data && !!(data.url || data.text || data.title || (data.files && data.files.length));
      };
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

  // WebViews can't save blob: or data: downloads, which the site uses for its
  // add-to-calendar (.ics), cover letter (.txt) and share card (.png) buttons. Keep each
  // object URL's Blob so a download click can hand the file to the app, even when the
  // page revokes the URL straight after clicking.
  var blobs = {};
  var createObjectURL = URL.createObjectURL;
  var revokeObjectURL = URL.revokeObjectURL;
  URL.createObjectURL = function (object) {
    var url = createObjectURL.apply(URL, arguments);
    if (object instanceof Blob) blobs[url] = object;
    return url;
  };
  URL.revokeObjectURL = function (url) {
    delete blobs[url];
    return revokeObjectURL.apply(URL, arguments);
  };

  function interceptDownload(anchor) {
    if (!anchor.hasAttribute('download')) return false;
    var href = anchor.href || '';
    var filename = anchor.getAttribute('download') || 'download';
    if (blobs[href]) return sendFile(blobs[href], filename, 'save');
    if (href.indexOf('data:') === 0) {
      fetch(href)
        .then(function (response) { return response.blob(); })
        .then(function (blob) { sendFile(blob, filename, 'save'); })
        .catch(function () {});
      return true;
    }
    return false;
  }

  // Downloads are usually a detached <a download> clicked from script...
  var anchorClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (interceptDownload(this)) return;
    return anchorClick.apply(this, arguments);
  };
  // ...or a real link the student taps.
  document.addEventListener('click', function (event) {
    var target = event.target;
    var anchor = target && target.closest ? target.closest('a[download]') : null;
    if (anchor && interceptDownload(anchor)) event.preventDefault();
  }, true);

  // Copy buttons: WebViews may refuse navigator.clipboard (Android especially, or when
  // the copy happens after an await). Fall back to the system clipboard via the app.
  function nativeCopy(text) {
    post({ type: 'copy', text: String(text) });
    return Promise.resolve();
  }
  var clipboard = navigator.clipboard;
  if (clipboard && typeof clipboard.writeText === 'function') {
    var writeText = clipboard.writeText.bind(clipboard);
    try {
      clipboard.writeText = function (text) {
        try {
          return writeText(text).catch(function () { return nativeCopy(text); });
        } catch (e) {
          return nativeCopy(text);
        }
      };
    } catch (e) {}
  } else {
    try {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: nativeCopy },
      });
    } catch (e) {}
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

/**
 * Script for re-tapping the current tab: scroll to the top like native lists do, and when
 * already at the top go back to the tab's start page (`url`).
 */
export function scrollToTopOrGoScript(url: string): string {
  return `(function () {
  var target = new URL(${JSON.stringify(url)});
  if (window.scrollY > 0) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (location.pathname !== target.pathname) {
    location.assign(target.href);
  }
})();
true;`;
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
    case 'copy':
      if (typeof message.text !== 'string') return null;
      return { type: 'copy', text: message.text };
    case 'file': {
      const { action, filename, mimeType, base64 } = message;
      if (action !== 'save' && action !== 'share') return null;
      if (typeof filename !== 'string' || typeof mimeType !== 'string') return null;
      if (typeof base64 !== 'string' || !base64 || base64.length > (MAX_FILE_BYTES * 4) / 3 + 4) {
        return null;
      }
      return { type: 'file', action, filename, mimeType, base64, text: optionalString(message.text) };
    }
    default:
      return null;
  }
}
