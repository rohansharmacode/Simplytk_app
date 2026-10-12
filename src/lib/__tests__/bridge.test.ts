/// <reference types="node" />

import vm from 'node:vm';

import { APP_CSS, bridgeScript, navigateScript, parseBridgeMessage, replyScript } from '../bridge';

const SCRIPT = bridgeScript({
  platform: 'ios',
  appVersion: '1.2.3',
  siteHosts: ['simplytk.com', 'www.simplytk.com'],
});

/** Run the injected script against a minimal fake page and capture what it posts. */
function runPage({
  hostname = 'simplytk.com',
  storage = {} as Record<string, string>,
  htmlClasses = [] as string[],
  title = 'CV Rater · simplytk',
  withHead = true,
} = {}) {
  const posted: Record<string, unknown>[] = [];
  const headChildren: { attributes: Record<string, string>; textContent: string }[] = [];
  const store = new Map(Object.entries(storage));
  const classes = new Set(htmlClasses);
  const navigator: Record<string, unknown> = {};

  const context: Record<string, unknown> = {
    location: { hostname },
    navigator,
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, String(value)),
      key: (index: number) => [...store.keys()][index] ?? null,
      get length() {
        return store.size;
      },
    },
    document: {
      readyState: 'complete',
      title,
      addEventListener: () => {},
      createElement: () => ({
        attributes: {} as Record<string, string>,
        textContent: '',
        setAttribute(name: string, value: string) {
          this.attributes[name] = value;
        },
      }),
      head: withHead ? { appendChild: (node: never) => headChildren.push(node) } : null,
      documentElement: {
        classList: {
          contains: (name: string) => classes.has(name),
          add: (...names: string[]) => names.forEach((name) => classes.add(name)),
        },
      },
    },
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    setInterval: () => 0,
    ReactNativeWebView: {
      postMessage: (message: string) => posted.push(JSON.parse(message)),
    },
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(SCRIPT, context);

  return {
    posted,
    headChildren,
    store,
    classes,
    navigator,
    run: (code: string) => vm.runInContext(code, context),
  };
}

describe('bridgeScript', () => {
  it('exposes the native API', () => {
    const page = runPage();
    expect(page.run('window.SimplytkNative.platform')).toBe('ios');
    expect(page.run('window.SimplytkNative.appVersion')).toBe('1.2.3');
    expect(page.run('Object.isFrozen(window.SimplytkNative)')).toBe(true);
  });

  it('reports theme, sign-in state and title from simplytk pages', () => {
    const page = runPage({
      storage: { 'sb-kfrlrioicoltydcmkpoi-auth-token': '{"access_token":"x"}' },
      htmlClasses: ['dark'],
    });
    expect(page.posted).toEqual([
      { type: 'state', dark: true, signedIn: true, title: 'CV Rater · simplytk' },
    ]);
    expect([...page.classes]).toEqual(['dark', 'simplytk-native-app', 'simplytk-native-ios']);
  });

  it('reports signed out without a Supabase session key', () => {
    const page = runPage({ storage: { 'simplytk-theme': 'light' } });
    expect(page.posted).toEqual([
      { type: 'state', dark: false, signedIn: false, title: 'CV Rater · simplytk' },
    ]);
  });

  it('defaults the site theme to the system setting, without overriding a choice', () => {
    expect(runPage().store.get('simplytk-theme')).toBe('system');
    expect(runPage({ storage: { 'simplytk-theme': 'dark' } }).store.get('simplytk-theme')).toBe(
      'dark',
    );
  });

  it("hides the site's own mobile tab bar", () => {
    const page = runPage();
    expect(page.headChildren).toHaveLength(1);
    expect(page.headChildren[0].textContent).toBe(APP_CSS);
    expect(page.headChildren[0].attributes).toEqual({ 'data-simplytk-native': '' });
  });

  it('waits for <head> before adding the style', () => {
    expect(() => runPage({ withHead: false })).not.toThrow();
  });

  it('stays quiet on other origins but still offers the API', () => {
    const page = runPage({ hostname: 'kfrlrioicoltydcmkpoi.supabase.co' });
    expect(page.posted).toEqual([]);
    expect(page.headChildren).toEqual([]);
    expect(page.store.has('simplytk-theme')).toBe(false);
    expect(page.run('typeof window.SimplytkNative.share')).toBe('function');
  });

  it('backs navigator.share with the native share sheet', async () => {
    const page = runPage();
    page.posted.length = 0;
    expect(typeof page.navigator.share).toBe('function');
    await page.run('navigator.share({ title: "Optiver", url: "https://simplytk.com/companies/optiver" })');
    expect(page.posted).toEqual([
      {
        type: 'share',
        title: 'Optiver',
        url: 'https://simplytk.com/companies/optiver',
      },
    ]);
  });

  it('keeps a native navigator.share when the WebView has one', () => {
    const posted: unknown[] = [];
    const nativeShare = () => Promise.resolve();
    const context: Record<string, unknown> = {
      location: { hostname: 'example.com' },
      navigator: { share: nativeShare },
      ReactNativeWebView: { postMessage: (message: string) => posted.push(message) },
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(SCRIPT, context);
    expect((context.navigator as { share: unknown }).share).toBe(nativeShare);
  });

  it('resolves requestPushToken with the reply from the app', async () => {
    const page = runPage();
    page.posted.length = 0;
    const pending = page.run('window.SimplytkNative.requestPushToken()') as Promise<unknown>;
    expect(page.posted).toEqual([{ type: 'push:request', id: 1 }]);

    page.run(replyScript(1, { status: 'granted', token: 'ExponentPushToken[abc]' }));
    await expect(pending).resolves.toEqual({ status: 'granted', token: 'ExponentPushToken[abc]' });
  });

  it('only installs once per page', () => {
    const page = runPage();
    page.run(SCRIPT);
    expect(page.posted).toHaveLength(1);
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
  });

  it.each([
    'not json',
    'null',
    '"state"',
    '{"type":"state","dark":"yes","signedIn":true}',
    '{"type":"share","title":"nothing to share"}',
    '{"type":"push:request","id":"1"}',
    '{"type":"push:request","id":1.5}',
    '{"type":"eval","code":"x"}',
  ])('rejects %s', (raw) => {
    expect(parseBridgeMessage(raw)).toBeNull();
  });
});
