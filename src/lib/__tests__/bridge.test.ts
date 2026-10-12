/// <reference types="node" />

import { JSDOM, VirtualConsole } from 'jsdom';
import vm from 'node:vm';

import {
  APP_CSS,
  bridgeScript,
  navigateScript,
  parseBridgeMessage,
  replyScript,
  scrollToTopOrGoScript,
} from '../bridge';

const SCRIPT = bridgeScript({
  platform: 'ios',
  appVersion: '1.2.3',
  siteHosts: ['simplytk.com', 'www.simplytk.com'],
});

type Posted = Record<string, unknown>;

const pages: JSDOM[] = [];
afterEach(() => {
  pages.splice(0).forEach((dom) => dom.window.close());
});

/**
 * Load a page in jsdom, inject the bridge the way the WebView does, and capture what it
 * posts to the app. jsdom has no object URLs or fetch, so those are stubbed like a browser.
 */
async function openPage({
  url = 'https://simplytk.com/cv-rater',
  storage = {} as Record<string, string>,
  htmlClass = '',
  body = '',
  removeHead = false,
  before,
}: {
  url?: string;
  storage?: Record<string, string>;
  htmlClass?: string;
  body?: string;
  removeHead?: boolean;
  before?: (window: JSDOM['window']) => void;
} = {}) {
  const dom = new JSDOM(
    `<!doctype html><html class="${htmlClass}"><head><title>CV Rater · simplytk</title></head><body>${body}</body></html>`,
    // A fresh VirtualConsole drops jsdom's "navigation not implemented" noise.
    { url, runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: new VirtualConsole() },
  );
  pages.push(dom);
  const { window } = dom;
  Object.entries(storage).forEach(([key, value]) => window.localStorage.setItem(key, value));

  const posted: Posted[] = [];
  Object.assign(window, {
    ReactNativeWebView: { postMessage: (message: string) => posted.push(JSON.parse(message)) },
  });
  let nextBlob = 0;
  window.URL.createObjectURL = () => `blob:${url}/${++nextBlob}`;
  window.URL.revokeObjectURL = () => {};
  Object.assign(window, {
    fetch: async (input: string) => {
      const comma = input.indexOf(',');
      const header = input.slice(0, comma);
      const data = input.slice(comma + 1);
      const type = header.replace(/^data:/, '').replace(/;base64$/, '');
      const text = header.endsWith(';base64')
        ? Buffer.from(data, 'base64').toString('binary')
        : decodeURIComponent(data);
      return { blob: async () => new window.Blob([text], { type }) };
    },
  });
  if (removeHead) window.document.head.remove();
  before?.(window);

  window.eval(SCRIPT);
  await settle();
  return { window, posted, run: (code: string) => window.eval(code) };
}

/** Let FileReader callbacks, observers and promise chains run. */
function settle() {
  return new Promise((resolve) => setTimeout(resolve, 20));
}

const ofType = (posted: Posted[], type: string) => posted.filter((message) => message.type === type);
const decode = (base64: unknown) => Buffer.from(String(base64), 'base64').toString('utf8');

describe('bridgeScript: native API', () => {
  it('exposes platform and version, read-only', async () => {
    const page = await openPage();
    expect(page.run('window.SimplytkNative.platform')).toBe('ios');
    expect(page.run('window.SimplytkNative.appVersion')).toBe('1.2.3');
    expect(page.run('Object.isFrozen(window.SimplytkNative)')).toBe(true);
  });

  it('resolves requestPushToken with the reply from the app', async () => {
    const page = await openPage();
    const pending = page.run('window.SimplytkNative.requestPushToken()') as Promise<unknown>;
    expect(ofType(page.posted, 'push:request')).toEqual([{ type: 'push:request', id: 1 }]);

    page.run(replyScript(1, { status: 'granted', token: 'ExponentPushToken[abc]' }));
    await expect(pending).resolves.toEqual({ status: 'granted', token: 'ExponentPushToken[abc]' });
  });

  it('only installs once per page', async () => {
    const page = await openPage();
    page.run(SCRIPT);
    await settle();
    expect(ofType(page.posted, 'state')).toHaveLength(1);
  });
});

describe('bridgeScript: site state', () => {
  it('reports theme, sign-in and title, and tags <html>', async () => {
    const page = await openPage({
      htmlClass: 'dark',
      storage: { 'sb-kfrlrioicoltydcmkpoi-auth-token': '{"access_token":"x"}' },
    });
    expect(ofType(page.posted, 'state')).toEqual([
      { type: 'state', dark: true, signedIn: true, title: 'CV Rater · simplytk' },
    ]);
    expect([...page.window.document.documentElement.classList]).toEqual([
      'dark',
      'simplytk-native-app',
      'simplytk-native-ios',
    ]);
  });

  it('reports theme switches straight away', async () => {
    const page = await openPage({ storage: { 'simplytk-theme': 'light' } });
    page.window.document.documentElement.classList.add('dark');
    await settle();
    expect(ofType(page.posted, 'state').map((message) => message.dark)).toEqual([false, true]);
  });

  it('reports signed out without a Supabase session key', async () => {
    const page = await openPage();
    expect(ofType(page.posted, 'state')[0]).toMatchObject({ signedIn: false });
  });

  it('defaults the site theme to the system setting, without overriding a choice', async () => {
    expect((await openPage()).window.localStorage.getItem('simplytk-theme')).toBe('system');
    const chosen = await openPage({ storage: { 'simplytk-theme': 'dark' } });
    expect(chosen.window.localStorage.getItem('simplytk-theme')).toBe('dark');
  });

  it('stays quiet on other origins but still offers the API', async () => {
    const page = await openPage({ url: 'https://kfrlrioicoltydcmkpoi.supabase.co/auth/v1/verify' });
    expect(page.posted).toEqual([]);
    expect(page.window.localStorage.getItem('simplytk-theme')).toBeNull();
    expect(page.window.document.querySelector('style[data-simplytk-native]')).toBeNull();
    expect(page.run('typeof window.SimplytkNative.share')).toBe('function');
  });
});

describe("bridgeScript: the site's own tab bar", () => {
  const nav = '<nav aria-label="Primary" class="fixed inset-x-0 bottom-0 md:hidden"></nav>';

  it('is hidden by an injected style', async () => {
    const page = await openPage({ body: nav });
    const style = page.window.document.head.querySelector('style[data-simplytk-native]');
    expect(style?.textContent).toBe(APP_CSS);
    const element = page.window.document.querySelector('nav')!;
    expect(page.window.getComputedStyle(element).display).toBe('none');
  });

  it('is hidden even when <head> is parsed after the script runs', async () => {
    const page = await openPage({ body: nav, removeHead: true });
    const { document } = page.window;
    document.documentElement.prepend(document.createElement('head'));
    await settle();
    expect(document.head.querySelector('style[data-simplytk-native]')).not.toBeNull();
  });

  it("leaves the desktop header's Primary nav alone", async () => {
    const page = await openPage({ body: '<nav aria-label="Primary" class="hidden md:flex"></nav>' });
    const element = page.window.document.querySelector('nav')!;
    expect(page.window.getComputedStyle(element).display).not.toBe('none');
  });
});

describe('bridgeScript: sharing', () => {
  it('backs navigator.share with the native share sheet', async () => {
    const page = await openPage();
    await page.run('navigator.share({ title: "Optiver", url: "https://simplytk.com/companies/optiver" })');
    expect(ofType(page.posted, 'share')).toEqual([
      { type: 'share', title: 'Optiver', url: 'https://simplytk.com/companies/optiver' },
    ]);
  });

  it('shares files, such as the share card image', async () => {
    const page = await openPage();
    expect(page.run('navigator.canShare({ files: [new File(["x"], "card.png")] })')).toBe(true);
    await page.run(
      'navigator.share({ files: [new File(["PNGDATA"], "card.png", { type: "image/png" })], text: "My streak" })',
    );
    await settle();
    expect(ofType(page.posted, 'file')).toEqual([
      expect.objectContaining({
        action: 'share',
        filename: 'card.png',
        mimeType: 'image/png',
        text: 'My streak',
      }),
    ]);
    expect(decode(ofType(page.posted, 'file')[0].base64)).toBe('PNGDATA');
  });

  it('keeps a native navigator.share when the WebView has one', async () => {
    const nativeShare = () => Promise.resolve();
    const page = await openPage({
      before: (window) => Object.assign(window.navigator, { share: nativeShare }),
    });
    expect(page.window.navigator.share).toBe(nativeShare);
  });
});

describe('bridgeScript: downloads', () => {
  it('hands a blob download to the app even when the URL is revoked at once', async () => {
    // simplytk.com's cover letter download.
    const page = await openPage();
    page.run(`
      var blob = new Blob(["Dear Optiver,"], { type: "text/plain;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "optiver-cover-letter.txt";
      a.click();
      URL.revokeObjectURL(url);
    `);
    await settle();
    const [file] = ofType(page.posted, 'file');
    expect(file).toMatchObject({
      action: 'save',
      filename: 'optiver-cover-letter.txt',
      mimeType: 'text/plain;charset=utf-8',
    });
    expect(decode(file.base64)).toBe('Dear Optiver,');
  });

  it('handles download links in the page that are clicked', async () => {
    // simplytk.com's add-to-calendar (.ics) download.
    const page = await openPage();
    const defaultPrevented = page.run(`
      var url = URL.createObjectURL(new Blob(["BEGIN:VCALENDAR"], { type: "text/calendar" }));
      var a = document.createElement("a");
      a.href = url;
      a.download = "deadline.ics";
      a.innerHTML = "<span>Download</span>";
      document.body.appendChild(a);
      var event = new MouseEvent("click", { bubbles: true, cancelable: true });
      a.querySelector("span").dispatchEvent(event);
      event.defaultPrevented;
    `);
    await settle();
    expect(defaultPrevented).toBe(true);
    expect(ofType(page.posted, 'file')).toEqual([
      expect.objectContaining({ filename: 'deadline.ics', mimeType: 'text/calendar' }),
    ]);
  });

  it('handles data: URL downloads', async () => {
    const page = await openPage();
    page.run(`
      var a = document.createElement("a");
      a.href = "data:text/plain;base64,${Buffer.from('hello').toString('base64')}";
      a.download = "note.txt";
      a.click();
    `);
    await settle();
    expect(decode(ofType(page.posted, 'file')[0]?.base64)).toBe('hello');
  });

  it('leaves ordinary links and http downloads to the WebView', async () => {
    const page = await openPage({ body: '<a href="https://simplytk.com/report.pdf" download>PDF</a>' });
    const defaultPrevented = page.run(`
      var event = new MouseEvent("click", { bubbles: true, cancelable: true });
      document.querySelector("a").dispatchEvent(event);
      event.defaultPrevented;
    `);
    await settle();
    expect(defaultPrevented).toBe(false);
    expect(ofType(page.posted, 'file')).toEqual([]);
  });
});

describe('bridgeScript: clipboard', () => {
  it('copies through the app when the WebView has no clipboard API', async () => {
    const page = await openPage();
    await page.run('navigator.clipboard.writeText("https://simplytk.com/r/abc")');
    expect(ofType(page.posted, 'copy')).toEqual([
      { type: 'copy', text: 'https://simplytk.com/r/abc' },
    ]);
  });

  it('falls back to the app when the WebView refuses the write', async () => {
    const page = await openPage({
      before: (window) =>
        Object.defineProperty(window.navigator, 'clipboard', {
          configurable: true,
          value: { writeText: () => Promise.reject(new Error('Write permission denied')) },
        }),
    });
    await page.run('navigator.clipboard.writeText("Dear Optiver,")');
    expect(ofType(page.posted, 'copy')).toEqual([{ type: 'copy', text: 'Dear Optiver,' }]);
  });

  it('leaves a working clipboard alone', async () => {
    const written: string[] = [];
    const page = await openPage({
      before: (window) =>
        Object.defineProperty(window.navigator, 'clipboard', {
          configurable: true,
          value: {
            writeText: (text: string) => {
              written.push(text);
              return Promise.resolve();
            },
          },
        }),
    });
    await page.run('navigator.clipboard.writeText("copied")');
    expect(written).toEqual(['copied']);
    expect(ofType(page.posted, 'copy')).toEqual([]);
  });
});

describe('scrollToTopOrGoScript', () => {
  function run(scrollY: number, pathname: string) {
    const calls: string[] = [];
    const context = {
      URL,
      window: {
        scrollY,
        scrollTo: () => calls.push('scrollTo'),
      },
      location: { pathname, assign: (href: string) => calls.push(`assign ${href}`) },
    };
    vm.createContext(context);
    vm.runInContext(scrollToTopOrGoScript('https://simplytk.com/internship-tracker'), context);
    return calls;
  }

  it('scrolls to the top first', () => {
    expect(run(640, '/companies/optiver')).toEqual(['scrollTo']);
  });

  it("then goes back to the tab's start page", () => {
    expect(run(0, '/companies/optiver')).toEqual(['assign https://simplytk.com/internship-tracker']);
  });

  it('does nothing at the top of the start page', () => {
    expect(run(0, '/internship-tracker')).toEqual([]);
  });
});

describe('navigateScript', () => {
  it('escapes the URL safely', () => {
    expect(navigateScript('https://simplytk.com/a"b')).toBe(
      'window.location.assign("https://simplytk.com/a\\"b"); true;',
    );
  });
});

describe('parseBridgeMessage', () => {
  it('accepts well-formed messages', () => {
    expect(parseBridgeMessage('{"type":"state","dark":false,"signedIn":true,"title":"Home"}')).toEqual(
      { type: 'state', dark: false, signedIn: true, title: 'Home' },
    );
    expect(parseBridgeMessage('{"type":"share","url":"https://simplytk.com"}')).toEqual({
      type: 'share',
      title: undefined,
      text: undefined,
      url: 'https://simplytk.com',
    });
    expect(parseBridgeMessage('{"type":"push:request","id":3}')).toEqual({
      type: 'push:request',
      id: 3,
    });
    expect(parseBridgeMessage('{"type":"copy","text":""}')).toEqual({ type: 'copy', text: '' });
    expect(
      parseBridgeMessage(
        '{"type":"file","action":"save","filename":"a.ics","mimeType":"text/calendar","base64":"QQ=="}',
      ),
    ).toEqual({
      type: 'file',
      action: 'save',
      filename: 'a.ics',
      mimeType: 'text/calendar',
      base64: 'QQ==',
      text: undefined,
    });
  });

  it.each([
    'not json',
    'null',
    '"state"',
    '{"type":"state","dark":"yes","signedIn":true}',
    '{"type":"share","title":"nothing to share"}',
    '{"type":"push:request","id":"1"}',
    '{"type":"push:request","id":1.5}',
    '{"type":"copy","text":5}',
    '{"type":"file","action":"open","filename":"a","mimeType":"x","base64":"QQ=="}',
    '{"type":"file","action":"save","filename":"a","mimeType":"x","base64":""}',
    '{"type":"file","action":"save","mimeType":"x","base64":"QQ=="}',
    '{"type":"eval","code":"x"}',
  ])('rejects %s', (raw) => {
    expect(parseBridgeMessage(raw)).toBeNull();
  });
});
