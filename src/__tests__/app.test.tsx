import { act, cleanup, configure, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import * as Clipboard from 'expo-clipboard';
import * as Notifications from 'expo-notifications';
import * as WebBrowser from 'expo-web-browser';
import { AppState, BackHandler, Platform, type AppStateStatus } from 'react-native';

import { NATIVE_DRILLS } from '@/components/drills/registry';
import { DRILL_GROUPS } from '@/lib/drills/catalogue';
import { shareFile } from '@/lib/files';
import { openOutside } from '@/lib/open';
import { syncPushToken } from '@/lib/push';
import { setSessionForTests } from '@/lib/session';
import * as SiteApi from '@/lib/site-api';
import { supabase } from '@/lib/supabase';
import * as Queries from '@/lib/tracker/queries';
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
  syncPushToken: jest.fn(() => Promise.resolve({ status: 'denied' })),
  forgetPushToken: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(() => Promise.resolve({ data: { session: null } })),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      signInWithPassword: jest.fn(() => Promise.resolve({ error: null })),
      signInWithIdToken: jest.fn(() => Promise.resolve({ error: null })),
      signInWithOtp: jest.fn(() => Promise.resolve({ error: null })),
      verifyOtp: jest.fn(() => Promise.resolve({ data: { session: {} }, error: null })),
      setSession: jest.fn(() => Promise.resolve({ data: { session: {} }, error: null })),
      signOut: jest.fn(() => Promise.resolve({ error: null })),
    },
  },
}));
jest.mock('@/lib/tracker/queries', () => ({
  PAGE_SIZE: 30,
  fetchOpenings: jest.fn(),
  fetchOpening: jest.fn(),
  fetchStarred: jest.fn(),
  star: jest.fn(() => Promise.resolve()),
  unstar: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/lib/site-api', () => ({
  ...jest.requireActual('@/lib/site-api'),
  getDaily: jest.fn(),
  submitDaily: jest.fn(),
  getStreak: jest.fn(),
  getLeaderboards: jest.fn(),
  getLeague: jest.fn(),
  savePushToken: jest.fn(() => Promise.resolve({ ok: true })),
  deletePushToken: jest.fn(() => Promise.resolve({ ok: true })),
}));
jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(false)),
  AppleAuthenticationButton: () => null,
  AppleAuthenticationButtonType: { SIGN_IN: 0 },
  AppleAuthenticationButtonStyle: { WHITE: 0, BLACK: 2 },
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));
jest.mock('expo-crypto', () => ({
  randomUUID: () => 'nonce',
  digestStringAsync: () => Promise.resolve('hashed'),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));

const SESSION = {
  access_token: 'access',
  refresh_token: 'refresh',
  expires_in: 3600,
  token_type: 'bearer',
  user: { id: 'user-1', user_metadata: { full_name: 'Rohan Sharma' } },
} as never;

const ID = '0f8a7c1e-2b3d-4e5f-8a9b-0c1d2e3f4a5b';

const OPENING = {
  id: ID,
  title: 'Spring Week 2027',
  programme_type: 'spring_week',
  location: 'London',
  deadline: '2099-11-20T23:59:00Z',
  apply_url: 'https://careers.gs.com/spring',
  status: 'open',
  first_seen_at: '2026-10-01T00:00:00Z',
  cover_letter_required: false,
  visa_sponsorship: null,
  companies: { name: 'Goldman Sachs', slug: 'goldman-sachs', logo_url: null },
};

const STREAK = {
  current: 6,
  best: 12,
  playedToday: false,
  atRisk: true,
  freezesLeft: 1,
  week: ['27', '28', '29', '30', '31', '01', '02'].map((d, i) => ({
    day: `2026-${i < 5 ? '10' : '11'}-${d}`,
    played: i < 6,
    frozen: false,
  })),
};

const LEAGUE = {
  weekStart: '2026-11-02',
  endsAt: '2099-11-09T00:00:00Z',
  tier: 'silver',
  cohort: 1,
  members: Array.from({ length: 30 }, (_, i) => ({
    rank: i + 1,
    points: 300 - i * 10,
    zone: i < 8 ? 'promote' : i >= 25 ? 'demote' : 'stay',
    username: i === 3 ? 'rohan' : `player${i + 1}`,
    isYou: i === 3,
    university: null,
  })),
  you: { rank: 4, points: 270, zone: 'promote' },
  lastWeek: null,
};

const PROBLEMS = [
  { kind: 'mental_maths', text: '12 + 30', answer: 42 },
  {
    kind: 'sprint',
    id: 's1',
    type: 'analogy',
    prompt: 'Hot is to cold as up is to?',
    options: ['Down', 'Left', 'Over', 'Under'],
    answer: 0,
    explanation: '',
  },
];

// Native tab screens are marked hidden from accessibility in tests (the native side decides
// what's visible), so queries have to include hidden elements.
configure({ defaultIncludeHiddenElements: true });

beforeEach(() => {
  resetWebViews();
  jest.clearAllMocks();
  setSessionForTests(SESSION);
  jest.mocked(Queries.fetchOpenings).mockResolvedValue([OPENING] as never);
  jest.mocked(Queries.fetchOpening).mockResolvedValue(OPENING as never);
  jest.mocked(Queries.fetchStarred).mockResolvedValue([]);
  jest.mocked(SiteApi.getDaily).mockResolvedValue({
    day: '2026-11-02',
    number: 210,
    total: 2,
    result: null,
    sessionId: 'session-1',
    problems: PROBLEMS,
  } as never);
  jest.mocked(SiteApi.getStreak).mockResolvedValue(STREAK as never);
  jest.mocked(SiteApi.getLeague).mockResolvedValue(LEAGUE as never);
  jest.mocked(SiteApi.getLeaderboards).mockResolvedValue({
    period: 'today',
    board: {
      day: '2026-11-05',
      number: 213,
      entries: [1, 2, 3].map((rank) => ({
        rank,
        username: `top${rank}`,
        isYou: false,
        university: null,
        linkedin: null,
        score: 20 - rank,
        durationMs: 60_000,
      })),
      players: 812,
      yourRank: 140,
      percentile: 83,
    },
    universities: {
      entries: [
        { rank: 1, university: 'LSE', points: 96, members: 41, isYours: false },
        { rank: 2, university: 'UCL', points: 90, members: 38, isYours: true },
      ],
      yourUniversity: 'UCL',
    },
  });
  jest.mocked(SiteApi.submitDaily).mockResolvedValue({ score: 2, total: 2, durationMs: 4000, detail: ['c', 'c'] });
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

async function press(text: string) {
  await act(async () => {
    fireEvent.press(screen.getByText(text));
  });
  await flush();
}

async function pressIn(label: string) {
  await act(async () => {
    fireEvent(screen.getByLabelText(label), 'pressIn');
  });
  await flush();
}

/** A simplytk.com page in a web view, over the tabs. */
async function openPage(path = '/cv-rater') {
  const launched = await launch(`/page?path=${encodeURIComponent(path)}`);
  const page = mountedWebViews().at(-1)!;
  return { ...launched, page };
}

const uris = () => mountedWebViews().map((webView) => webView.props.source.uri);

describe('signing in', () => {
  it('shows the sign-in screen when nobody is signed in, with no way round it', async () => {
    setSessionForTests(null);
    const { app } = await launch('/tracker');
    expect(app.getPathname()).toBe('/sign-in');
    expect(screen.getByText('Your stars, streak and scores are the same here and on simplytk.com.')).toBeTruthy();
    expect(Queries.fetchOpenings).not.toHaveBeenCalled();
  });

  it('signs in with the website account', async () => {
    setSessionForTests(null);
    await launch();
    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Email'), ' rohan@example.com ');
      fireEvent.changeText(screen.getByLabelText('Password'), 'hunter22');
    });
    await press('Sign in');
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'rohan@example.com', password: 'hunter22' });
  });

  it('signs in with a texted code', async () => {
    setSessionForTests(null);
    await launch();
    await press('Phone');
    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Mobile number'), '07700 900123');
    });
    await press('Text me a code');
    expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({ phone: '+447700900123' });
    expect(screen.getByText('We texted a code to +447700900123.')).toBeTruthy();
    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Code'), '123 456');
    });
    await press('Verify and sign in');
    expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({ phone: '+447700900123', token: '123456', type: 'sms' });
  });

  it('signs in with Google through the website’s sign-in', async () => {
    setSessionForTests(null);
    jest.spyOn(Platform, 'Version', 'get').mockReturnValue('18.2');
    const openAuth = jest
      .spyOn(WebBrowser, 'openAuthSessionAsync')
      .mockResolvedValue({ type: 'success', url: 'https://simplytk.com/auth#access_token=a&refresh_token=r&state=nonce' });
    await launch();
    await press('Continue with Google');
    expect(openAuth).toHaveBeenCalledWith(
      expect.stringContaining('https://simplytk.com/~oauth/initiate?provider=google'),
      'https://simplytk.com/auth',
      { preferUniversalLinks: true },
    );
    expect(supabase.auth.setSession).toHaveBeenCalledWith({ access_token: 'a', refresh_token: 'r' });
  });

  it('explains when email sign-in is switched off', async () => {
    setSessionForTests(null);
    jest.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
      error: { code: 'email_provider_disabled', message: 'Email logins are disabled' },
    } as never);
    await launch();
    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Email'), 'rohan@example.com');
      fireEvent.changeText(screen.getByLabelText('Password'), 'hunter22');
    });
    await press('Sign in');
    expect(screen.getByText(/Email sign-in isn’t available right now/)).toBeTruthy();
  });

  it('sends new students to the website to make an account', async () => {
    setSessionForTests(null);
    await launch();
    await press('Create an account on simplytk.com');
    expect(openOutside).toHaveBeenCalledWith('https://simplytk.com/auth', 'browser');
  });

  it('keeps the device token in step with the account', async () => {
    await launch();
    expect(syncPushToken).toHaveBeenCalledWith({ ask: false });
  });
});

describe('Home', () => {
  it('shows the streak, today’s challenge, the league place and starred openings', async () => {
    jest.mocked(Queries.fetchStarred).mockResolvedValue([OPENING] as never);
    await launch();
    expect(screen.getAllByText('6 days').length).toBeGreaterThan(0);
    expect(screen.getByText('Play today to keep it')).toBeTruthy();
    expect(screen.getByText('#4')).toBeTruthy();
    expect(screen.getAllByText('#210').length).toBeGreaterThan(0);
    // Starred openings show on Home and in the Tracker's starred list.
    expect(screen.getAllByText('Spring Week 2027').length).toBeGreaterThan(0);
    expect(mountedWebViews()).toEqual([]);
  });

  it('starts today’s challenge', async () => {
    const { app } = await launch();
    await press('Start challenge');
    expect(app.getPathname()).toBe('/challenge');
  });

  it('offers the website’s daily challenge until the site serves the app’s endpoints', async () => {
    jest.mocked(SiteApi.getDaily).mockRejectedValue(new SiteApi.SiteApiMissing('/api/app/daily'));
    const { app } = await launch();
    await press('Play on simplytk.com');
    expect(app.getPathname()).toBe('/page');
    expect(app.getSearchParams()).toMatchObject({ path: '/daily' });
  });
});

describe('Tracker', () => {
  it('lists openings and filters them', async () => {
    await launch('/tracker');
    expect(screen.getByText('Spring Week 2027')).toBeTruthy();
    expect(Queries.fetchOpenings).toHaveBeenLastCalledWith(
      { region: 'uk', types: [], firm: '', deadline: 'any' },
      0,
    );
    await press('Spring week');
    await press('Closing this week');
    await press('US');
    expect(Queries.fetchOpenings).toHaveBeenLastCalledWith(
      { region: 'us', types: ['spring_week'], firm: '', deadline: 'week' },
      0,
    );
  });

  it('stars an opening, and asks for notifications the first time', async () => {
    await launch('/tracker');
    await act(async () => {
      fireEvent.press(screen.getAllByLabelText('Star for alerts')[0]);
    });
    await flush();
    expect(Queries.star).toHaveBeenCalledWith(ID);
    expect(syncPushToken).toHaveBeenCalledWith({ ask: true });
    expect(screen.getAllByLabelText('Remove star').length).toBeGreaterThan(0);
  });

  it('opens an opening with its apply link', async () => {
    const { app } = await launch('/tracker');
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Goldman Sachs Spring Week 2027'));
    });
    await flush();
    expect(app.getPathname()).toBe(`/opening/${ID}`);
    await press('Apply on the firm’s site');
    expect(openOutside).toHaveBeenCalledWith('https://careers.gs.com/spring', 'browser');
  });
});

describe('daily challenge', () => {
  beforeEach(() => jest.useFakeTimers());
  // Unmount while the fake clock still drives React's timers, or the next test waits on them.
  afterEach(async () => {
    await cleanup();
    jest.useRealTimers();
  });

  it('plays today’s set on the keypad and posts the run for the site to mark', async () => {
    await launch('/challenge');
    expect(screen.getByText('12 + 30')).toBeTruthy();
    await pressIn('4');
    await pressIn('2');
    await flush(500);
    await pressIn('Submit answer');
    await flush(300);
    expect(screen.getByText('Hot is to cold as up is to?')).toBeTruthy();
    await flush(500);
    await act(async () => {
      fireEvent(screen.getByText('Down'), 'pressIn');
    });
    await flush(300);

    expect(SiteApi.submitDaily).toHaveBeenCalledWith('session-1', [
      { i: 0, a: '42', t: expect.any(Number) },
      { i: 1, a: 'Down', t: expect.any(Number) },
    ]);
    const [, events] = jest.mocked(SiteApi.submitDaily).mock.calls[0];
    expect(events[1].t - events[0].t).toBeGreaterThanOrEqual(200);
    expect(screen.getByText('See the leaderboard')).toBeTruthy();
  });

});

describe('daily challenge, already played', () => {
  it('shows today’s result when the student has already played', async () => {
    jest.mocked(SiteApi.getDaily).mockResolvedValue({
      day: '2026-11-02',
      number: 210,
      total: 2,
      result: { score: 1, total: 2, durationMs: 61_000, detail: ['c', 'w'] },
      sessionId: null,
      problems: PROBLEMS,
    } as never);
    await launch('/challenge');
    expect(screen.getByText('Answer: 42')).toBeTruthy();
    expect(SiteApi.submitDaily).not.toHaveBeenCalled();
  });
});

describe('Ranks', () => {
  it('pins your own place under the board', async () => {
    await launch('/ranks');
    expect(screen.getByText('top1')).toBeTruthy();
    expect(screen.getByLabelText('You: rank 140, Anonymous, –')).toBeTruthy();
    expect(screen.getByText('Ahead of 83% of players')).toBeTruthy();
    expect(SiteApi.getLeaderboards).toHaveBeenCalledWith('today');
  });

  it('switches to the university board', async () => {
    await launch('/ranks?board=universities');
    expect(screen.getByText('LSE')).toBeTruthy();
    expect(screen.getByLabelText('You: rank 2, UCL, 90 pts')).toBeTruthy();
  });

  it('shows the weekly league from a link', async () => {
    await launch('/ranks?board=league');
    expect(screen.getByText('rohan (you)')).toBeTruthy();
    expect(screen.getByLabelText('You: rank 4, rohan, 270 pts')).toBeTruthy();
  });
});

describe('links inside a page', () => {
  it('keeps simplytk pages and iframes in the app and sends the rest out', async () => {
    const { page } = await openPage();
    // Unlike the other callbacks, this one gets the request itself, not { nativeEvent }.
    const request = (url: string, isTopFrame = true) =>
      page.props.onShouldStartLoadWithRequest({ url, isTopFrame }) as boolean;

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
    const { page } = await openPage();
    await call(page, 'onOpenWindow', { targetUrl: 'https://simplytk.com/pricing' });
    expect(page.injectJavaScript).toHaveBeenCalledWith(
      'window.location.assign("https://simplytk.com/pricing"); true;',
    );
    await call(page, 'onOpenWindow', { targetUrl: 'https://calendar.google.com/calendar/render' });
    expect(openOutside).toHaveBeenCalledWith('https://calendar.google.com/calendar/render', 'browser');
  });

  it('injects the bridge', async () => {
    const { page } = await openPage();
    expect(page.props.injectedJavaScriptBeforeContentLoaded).toContain('window.SimplytkNative');
    expect(page.props.applicationNameForUserAgent).toMatch(/^simplytk-app\/\d+\.\d+\.\d+$/);
  });
});

describe('deep links', () => {
  it('opens other pages over the tabs', async () => {
    const { app } = await launch('/page?path=%2Fcv-rater');
    expect(app.getPathname()).toBe('/page');
    expect(uris()).toContain('https://simplytk.com/cv-rater');
  });

  it('opens an opening natively', async () => {
    const { app } = await launch(`/opening/${ID}`);
    expect(app.getPathname()).toBe(`/opening/${ID}`);
    expect(screen.getByText('Apply on the firm’s site')).toBeTruthy();
    expect(Queries.fetchOpening).toHaveBeenCalledWith(ID);
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

  it('opens the drills', async () => {
    const { app } = await launch('/more');
    await press('Drills');
    expect(app.getPathname()).toBe('/drills');
  });
});

describe('Drills', () => {
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
  // Unmount while the fake clock still drives React's timers, or the next test waits on them.
  afterEach(async () => {
    await cleanup();
    jest.useRealTimers();
  });

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
  it('copies to the system clipboard', async () => {
    const { page } = await openPage();
    await post(page, { type: 'copy', text: 'Dear Optiver,' });
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('Dear Optiver,');
  });

  it('saves downloads through the share sheet', async () => {
    const { page } = await openPage();
    const file = {
      type: 'file',
      action: 'save',
      filename: 'deadline.ics',
      mimeType: 'text/calendar',
      base64: 'QkVHSU4=',
    };
    await post(page, file);
    expect(shareFile).toHaveBeenCalledWith({ ...file, text: undefined });
  });

  it('ignores clipboard and file requests from other sites', async () => {
    const { page } = await openPage();
    await post(page, { type: 'copy', text: 'x' }, 'https://evil.example/');
    await post(
      page,
      { type: 'file', action: 'save', filename: 'a', mimeType: 'text/plain', base64: 'QQ==' },
      'https://evil.example/',
    );
    expect(Clipboard.setStringAsync).not.toHaveBeenCalled();
    expect(shareFile).not.toHaveBeenCalled();
  });

  it('answers push token requests', async () => {
    const { page } = await openPage();
    await post(page, { type: 'push:request', id: 7 });
    await flush();
    expect(page.injectJavaScript).toHaveBeenCalledWith(
      'window.__simplytkNativeReply && window.__simplytkNativeReply(7, {"status":"granted","token":"ExponentPushToken[t]"}); true;',
    );
  });
});

describe('load failures', () => {
  it('shows a retry screen that reloads the failed page', async () => {
    const { page } = await openPage();
    await call(page, 'onError', {
      url: 'https://simplytk.com/cv-rater',
      code: -1009,
      domain: 'NSURLErrorDomain',
      description: 'The Internet connection appears to be offline.',
    });
    expect(screen.getByText('Can’t reach simplytk')).toBeTruthy();

    await press('Try again');
    expect(screen.queryByText('Can’t reach simplytk')).toBeNull();
    expect(page.mounted).toBe(false);
    expect(uris()).toEqual(['https://simplytk.com/cv-rater']);
  });

  it('retries by itself when the app comes back to the foreground', async () => {
    const listeners: ((state: AppStateStatus) => void)[] = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      listeners.push(listener);
      return { remove: () => listeners.splice(listeners.indexOf(listener), 1) } as never;
    });
    const { page } = await openPage();
    await call(page, 'onError', { url: 'https://simplytk.com/cv-rater', code: -1009 });
    expect(screen.getByText('Can’t reach simplytk')).toBeTruthy();

    await act(async () => listeners.forEach((listener) => listener('active')));
    await flush();
    expect(screen.queryByText('Can’t reach simplytk')).toBeNull();
    expect(uris()).toEqual(['https://simplytk.com/cv-rater']);
  });

  it('ignores navigations the app cancelled itself', async () => {
    const { page } = await openPage();
    await call(page, 'onError', { url: 'https://calendly.com', code: -999, domain: 'NSURLErrorDomain' });
    expect(screen.queryByText('Can’t reach simplytk')).toBeNull();
  });
});

describe('notifications', () => {
  const tap = (data: object) => ({
    notification: { request: { content: { data } } },
  });

  it('opens the opening an alert is about, with its apply link', async () => {
    const { app } = await launch();
    const listener = jest.mocked(Notifications.addNotificationResponseReceivedListener).mock.calls[0][0];
    await act(async () => {
      listener(tap({ jobId: ID, url: 'https://careers.gs.com/spring' }) as never);
    });
    await flush();
    expect(app.getPathname()).toBe(`/opening/${ID}`);
    expect(screen.getByText('Apply on the firm’s site')).toBeTruthy();
  });

  it('opens the linked page when a notification launched the app', async () => {
    jest
      .mocked(Notifications.getLastNotificationResponse)
      .mockReturnValueOnce(tap({ url: 'https://simplytk.com/cv-rater' }) as never);
    const { app } = await launch();
    expect(app.getPathname()).toBe('/page');
    expect(uris()).toContain('https://simplytk.com/cv-rater');
    expect(Notifications.clearLastNotificationResponse).toHaveBeenCalled();
  });

  it('ignores notifications without a link', async () => {
    const { app } = await launch();
    const listener = jest.mocked(Notifications.addNotificationResponseReceivedListener).mock.calls[0][0];
    await act(async () => {
      listener(tap({}) as never);
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

    const { page } = await openPage();
    const navigation = (canGoBack: boolean) =>
      act(async () => {
        page.props.onNavigationStateChange({ canGoBack, url: 'https://simplytk.com/cv-rater' });
      });

    await navigation(false);
    expect(pressBack()).toBe(false);
    expect(page.goBack).not.toHaveBeenCalled();

    await navigation(true);
    expect(pressBack()).toBe(true);
    expect(page.goBack).toHaveBeenCalledTimes(1);
  });
});
