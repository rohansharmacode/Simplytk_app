import { act, cleanup, configure, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Notifications from 'expo-notifications';
import { AppState, BackHandler, Platform, type AppStateStatus } from 'react-native';

import { NATIVE_DRILLS } from '@/components/drills/registry';
import { DRILL_GROUPS } from '@/lib/drills/catalogue';
import { shareFile } from '@/lib/files';
import { openOutside } from '@/lib/open';
import { mountedWebViews, resetWebViews, type MockWebView } from '@/test/mock-webview';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories can't import
jest.mock('react-native-webview', () => require('@/test/mock-webview'));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(() => Promise.resolve(true)) }));
jest.mock('@/lib/files', () => ({ shareFile: jest.fn(() => Promise.resolve()) }));
jest.mock('@/lib/open', () => ({
  openOutside: jest.fn(() => Promise.resolve()),
  shareLink: jest.fn(() => Promise.resolve()),
}));
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getLastNotificationResponse: jest.fn(() => null),
  clearLastNotificationResponse: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  performAndroidHapticsAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
  AndroidHaptics: { Confirm: 'confirm', Reject: 'reject' },
}));
jest.mock('expo-sqlite/kv-store', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItemSync: (key: string) => store.get(key) ?? null,
      setItemSync: (key: string, value: string) => void store.set(key, value),
    },
  };
});
jest.mock('@/lib/push', () => ({
  requestPushToken: jest.fn(() => Promise.resolve({ status: 'granted', token: 'ExponentPushToken[t]' })),
}));

// Native tab screens are marked hidden from accessibility in tests (the native side decides
// what's visible), so queries have to include hidden elements.
configure({ defaultIncludeHiddenElements: true });

beforeEach(() => {
  resetWebViews();
  jest.clearAllMocks();
});

// Unmount each test's app before the next starts; the router's store is shared.
afterEach(async () => {
  await cleanup();
  jest.restoreAllMocks();
});

/** Render the real app (src/app) at `url`. */
async function launch(url = '/') {
  // renderRouter's router queries sit on the promise it returns, not on the resolved
  // value, so hand back the promise inside an object (returning it would unwrap it).
  const app = renderRouter('./src/app', { initialUrl: url });
  await app;
  await flush();
  return { app };
}

async function flush(ms = 0) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

/** Fire a WebView callback as the native side would, letting effects and timers settle. */
async function call(webView: MockWebView, prop: string, nativeEvent: Record<string, unknown> = {}) {
  let result: unknown;
  await act(async () => {
    result = webView.props[prop]({ nativeEvent });
  });
  return result;
}

function post(webView: MockWebView, message: object, url = 'https://simplytk.com/cv-rater') {
  return call(webView, 'onMessage', { data: JSON.stringify(message), url });
}

async function go(href: string) {
  await act(async () => {
    router.navigate(href as never);
  });
  await flush();
}

async function press(text: string) {
  await act(async () => {
    fireEvent.press(screen.getByText(text));
  });
  await flush();
}

const uris = () => mountedWebViews().map((webView) => webView.props.source.uri);

describe('launch', () => {
  it('opens Home on the dashboard, with the bridge injected', async () => {
    const { app } = await launch();
    expect(app.getPathname()).toBe('/');
    // Only Home: the other tabs wait until they're opened.
    expect(uris()).toEqual(['https://simplytk.com/dashboard?source=app']);
    const [home] = mountedWebViews();
    expect(home.props.injectedJavaScriptBeforeContentLoaded).toContain('window.SimplytkNative');
    expect(home.props.applicationNameForUserAgent).toMatch(/^simplytk-app\/\d+\.\d+\.\d+$/);
  });

  it('loads the Tracker tab in the background once Home has loaded', async () => {
    await launch();
    const [home] = mountedWebViews();
    await call(home, 'onLoadEnd');
    await flush(1500);
    expect(uris()).toEqual([
      'https://simplytk.com/dashboard?source=app',
      'https://simplytk.com/internship-tracker?source=app',
    ]);
  });

  it('loads other tabs when first opened', async () => {
    await launch();
    await go('/progress');
    expect(uris()).toContain('https://simplytk.com/progress?source=app');
  });
});

describe('links inside a page', () => {
  it('keeps simplytk pages and iframes in the app and sends the rest out', async () => {
    await launch();
    const [home] = mountedWebViews();
    // Unlike the other callbacks, this one gets the request itself, not { nativeEvent }.
    const request = (url: string, isTopFrame = true) =>
      home.props.onShouldStartLoadWithRequest({ url, isTopFrame }) as boolean;

    expect(request('https://simplytk.com/companies/optiver')).toBe(true);
    expect(request('https://js.stripe.com/v3/elements-inner.html', false)).toBe(true);
    expect(request('https://calendly.com/tanuj-kakumani/kickstarter')).toBe(false);
    expect(openOutside).toHaveBeenLastCalledWith('https://calendly.com/tanuj-kakumani/kickstarter', 'browser');
    expect(request('mailto:hello@simplytk.com')).toBe(false);
    expect(openOutside).toHaveBeenLastCalledWith('mailto:hello@simplytk.com', 'system');
    expect(request('javascript:alert(1)')).toBe(false);
    expect(openOutside).toHaveBeenCalledTimes(2);
  });

  it('opens target=_blank links in place or outside', async () => {
    await launch();
    const [home] = mountedWebViews();
    await call(home, 'onOpenWindow', { targetUrl: 'https://simplytk.com/pricing' });
    expect(home.injectJavaScript).toHaveBeenCalledWith(
      'window.location.assign("https://simplytk.com/pricing"); true;',
    );
    await call(home, 'onOpenWindow', { targetUrl: 'https://calendar.google.com/calendar/render' });
    expect(openOutside).toHaveBeenCalledWith('https://calendar.google.com/calendar/render', 'browser');
  });
});

describe('deep links', () => {
  it('opens a site URL in the tab that owns it', async () => {
    const { app } = await launch('/tracker?path=%2Fcompanies%2Foptiver');
    expect(app.getPathname()).toBe('/tracker');
    expect(uris()).toContain('https://simplytk.com/companies/optiver');
    // The param is cleared once used, so the same link can be opened again.
    expect(app.getSearchParams()).toEqual({});
  });

  it('navigates an open tab to the linked page', async () => {
    await launch();
    const [home] = mountedWebViews();
    await call(home, 'onLoad');
    await go('/?path=%2Fdashboard%2Fapplications');
    expect(home.injectJavaScript).toHaveBeenCalledWith(
      'window.location.assign("https://simplytk.com/dashboard/applications"); true;',
    );
  });

  it('opens other pages over the tabs', async () => {
    const { app } = await launch('/page?path=%2Fcv-rater');
    expect(app.getPathname()).toBe('/page');
    expect(uris()).toContain('https://simplytk.com/cv-rater');
  });
});

describe('More tab', () => {
  it('opens menu entries as pages', async () => {
    const { app } = await launch('/more');
    await press('CV rater');
    expect(app.getPathname()).toBe('/page');
    expect(app.getSearchParams()).toMatchObject({ path: '/cv-rater', title: 'CV rater' });
    expect(uris()).toContain('https://simplytk.com/cv-rater');
  });

  it('links to account settings, where accounts can be deleted', async () => {
    await launch('/more');
    expect(screen.getByText('Account settings')).toBeTruthy();
  });
});

describe('Drills tab', () => {
  it('opens drills that are not native yet on the site', async () => {
    const { app } = await launch('/drills');
    await press('Sequences');
    expect(app.getPathname()).toBe('/page');
    expect(app.getSearchParams()).toMatchObject({ path: '/sequences', title: 'Sequences' });
  });

  it('plays native drills in the app', async () => {
    const { app } = await launch('/drills');
    await press('Mental Maths');
    expect(app.getPathname()).toBe('/play/mental-maths');
    expect(screen.getByText('Start')).toBeTruthy();
  });

  it('opens native drills from simplytk.com links', async () => {
    const { app } = await launch('/play/fast-fractions');
    expect(app.getPathname()).toBe('/play/fast-fractions');
    expect(mountedWebViews()).toEqual([]);
  });

  it('has a game for every drill the catalogue marks native', () => {
    const native = DRILL_GROUPS.flatMap((g) => g.drills).filter((d) => d.native).map((d) => d.slug);
    expect(Object.keys(NATIVE_DRILLS).sort()).toEqual(native.sort());
  });
});

describe('Mental Maths', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  /** The answer to the question on screen. */
  function answer() {
    const label = screen.getByLabelText(/^\d+ [+−×÷] \d+$/).props.accessibilityLabel as string;
    const [left, op, right] = label.split(' ');
    const [a, b] = [Number(left), Number(right)];
    return String({ '+': a + b, '−': a - b, '×': a * b, '÷': a / b }[op]);
  }

  async function type(text: string) {
    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Answer'), text);
    });
  }

  it('scores answers as they are typed and keeps the best when time runs out', async () => {
    await launch('/play/mental-maths');
    await press('30s');
    await press('Start');

    await type('1');
    expect(screen.getByLabelText('Score').props.children).toBe(0);
    await type(answer());
    await type(answer());
    expect(screen.getByLabelText('Score').props.children).toBe(2);
    expect(screen.getByLabelText('Answer').props.value).toBe('');

    await flush(31_000);
    expect(screen.getByLabelText('Final score').props.children).toBe(2);
    expect(screen.getByText('New personal best')).toBeTruthy();
    expect(screen.getByText('Your best at this length: 2')).toBeTruthy();
  });
});

describe('messages from the page', () => {
  it('follows the site theme in the native chrome', async () => {
    await launch();
    const [home] = mountedWebViews();
    await post(home, { type: 'state', dark: true, signedIn: false, title: 'Home · simplytk' });
    expect(home.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ backgroundColor: '#12141A' })]),
    );
    await post(home, { type: 'state', dark: false, signedIn: false, title: 'Home · simplytk' });
    expect(home.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ backgroundColor: '#F6F7FA' })]),
    );
  });

  it('reloads a tab that missed a sign-in when it is next opened', async () => {
    await launch();
    const [home] = mountedWebViews();
    await go('/tracker');
    const tracker = mountedWebViews()[1];
    await post(tracker, { type: 'state', dark: false, signedIn: false, title: 'Tracker' });

    await go('/');
    await post(home, { type: 'state', dark: false, signedIn: true, title: 'Home' });
    expect(tracker.reload).not.toHaveBeenCalled();

    await go('/tracker');
    expect(tracker.reload).toHaveBeenCalledTimes(1);
    expect(home.reload).not.toHaveBeenCalled();
  });

  it('copies to the system clipboard', async () => {
    await launch();
    const [home] = mountedWebViews();
    await post(home, { type: 'copy', text: 'Dear Optiver,' });
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('Dear Optiver,');
  });

  it('saves downloads through the share sheet', async () => {
    await launch();
    const [home] = mountedWebViews();
    const file = {
      type: 'file',
      action: 'save',
      filename: 'deadline.ics',
      mimeType: 'text/calendar',
      base64: 'QkVHSU4=',
    };
    await post(home, file);
    expect(shareFile).toHaveBeenCalledWith({ ...file, text: undefined });
  });

  it('ignores clipboard and file requests from other sites', async () => {
    await launch();
    const [home] = mountedWebViews();
    await post(home, { type: 'copy', text: 'x' }, 'https://evil.example/');
    await post(
      home,
      { type: 'file', action: 'save', filename: 'a', mimeType: 'text/plain', base64: 'QQ==' },
      'https://evil.example/',
    );
    expect(Clipboard.setStringAsync).not.toHaveBeenCalled();
    expect(shareFile).not.toHaveBeenCalled();
  });

  it('answers push token requests', async () => {
    await launch();
    const [home] = mountedWebViews();
    await post(home, { type: 'push:request', id: 7 });
    await flush();
    expect(home.injectJavaScript).toHaveBeenCalledWith(
      'window.__simplytkNativeReply && window.__simplytkNativeReply(7, {"status":"granted","token":"ExponentPushToken[t]"}); true;',
    );
  });
});

describe('load failures', () => {
  it('shows a retry screen that reloads the failed page', async () => {
    await launch();
    const [home] = mountedWebViews();
    await call(home, 'onError', {
      url: 'https://simplytk.com/dashboard?source=app',
      code: -1009,
      domain: 'NSURLErrorDomain',
      description: 'The Internet connection appears to be offline.',
    });
    expect(screen.getByText('Can’t reach simplytk')).toBeTruthy();

    await press('Try again');
    expect(screen.queryByText('Can’t reach simplytk')).toBeNull();
    expect(home.mounted).toBe(false);
    expect(uris()).toEqual(['https://simplytk.com/dashboard?source=app']);
  });

  it('retries by itself when the app comes back to the foreground', async () => {
    const listeners: ((state: AppStateStatus) => void)[] = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      listeners.push(listener);
      return { remove: () => listeners.splice(listeners.indexOf(listener), 1) } as never;
    });
    await launch();
    const [home] = mountedWebViews();
    await call(home, 'onError', { url: 'https://simplytk.com/dashboard', code: -1009 });
    expect(screen.getByText('Can’t reach simplytk')).toBeTruthy();

    await act(async () => listeners.forEach((listener) => listener('active')));
    await flush();
    expect(screen.queryByText('Can’t reach simplytk')).toBeNull();
    expect(uris()).toEqual(['https://simplytk.com/dashboard']);
  });

  it('ignores navigations the app cancelled itself', async () => {
    await launch();
    const [home] = mountedWebViews();
    await call(home, 'onError', { url: 'https://calendly.com', code: -999, domain: 'NSURLErrorDomain' });
    expect(screen.queryByText('Can’t reach simplytk')).toBeNull();
  });
});

describe('notifications', () => {
  const tap = (url: string) => ({
    notification: { request: { content: { data: { url } } } },
  });

  it('opens the linked page when a notification is tapped', async () => {
    const { app } = await launch();
    const listener = jest.mocked(Notifications.addNotificationResponseReceivedListener).mock
      .calls[0][0];
    await act(async () => {
      listener(tap('https://simplytk.com/companies/citadel') as never);
    });
    await flush();
    expect(app.getPathname()).toBe('/tracker');
    expect(uris()).toContain('https://simplytk.com/companies/citadel');
  });

  it('opens the linked page when a notification launched the app', async () => {
    jest
      .mocked(Notifications.getLastNotificationResponse)
      .mockReturnValueOnce(tap('https://simplytk.com/cv-rater') as never);
    const { app } = await launch();
    expect(app.getPathname()).toBe('/page');
    expect(uris()).toContain('https://simplytk.com/cv-rater');
    expect(Notifications.clearLastNotificationResponse).toHaveBeenCalled();
  });

  it('ignores notifications without a link', async () => {
    const { app } = await launch();
    const listener = jest.mocked(Notifications.addNotificationResponseReceivedListener).mock
      .calls[0][0];
    await act(async () => {
      listener({ notification: { request: { content: { data: {} } } } } as never);
    });
    expect(app.getPathname()).toBe('/');
  });
});

describe('Android back button', () => {
  it('goes back in the page before leaving the screen', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    type Handler = Parameters<typeof BackHandler.addEventListener>[1];
    const handlers: Handler[] = [];
    const pressBack = () => handlers.at(-1)?.({} as Parameters<Handler>[0]);
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
      handlers.push(handler);
      return { remove: () => handlers.splice(handlers.indexOf(handler), 1) };
    });

    await launch();
    const [home] = mountedWebViews();
    const navigation = (canGoBack: boolean) =>
      act(async () => {
        home.props.onNavigationStateChange({ canGoBack, url: 'https://simplytk.com/dashboard' });
      });

    await navigation(false);
    expect(pressBack()).toBe(false);
    expect(home.goBack).not.toHaveBeenCalled();

    await navigation(true);
    expect(pressBack()).toBe(true);
    expect(home.goBack).toHaveBeenCalledTimes(1);
  });
});
