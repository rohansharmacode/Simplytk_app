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
import * as Applications from '@/lib/applications/queries';
import * as Boards from '@/lib/openings/queries';
import * as Queries from '@/lib/tracker/queries';
import { mountedWebViews, resetWebViews, type MockWebView } from '@/test/mock-webview';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories can't import
jest.mock('react-native-webview', () => require('@/test/mock-webview'));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(() => Promise.resolve(true)) }));
jest.mock('@/lib/files', () => ({ shareFile: jest.fn(() => Promise.resolve()) }));
jest.mock('@/lib/open', () => ({
  openOutside: jest.fn(() => Promise.resolve()),
  shareLink: jest.fn(() => Promise.resolve()),
  copyText: jest.fn(() => Promise.resolve()),
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
jest.mock('@/lib/applications/queries', () => ({
  ...jest.requireActual('@/lib/applications/queries'),
  fetchApplications: jest.fn(),
  fetchApplicationForJob: jest.fn(),
  setStage: jest.fn(() => Promise.resolve()),
  trackOpening: jest.fn(() => Promise.resolve()),
  removeApplication: jest.fn(() => Promise.resolve()),
  fetchSavedOpportunityUrls: jest.fn(),
  saveOpportunity: jest.fn(() => Promise.resolve()),
  unsaveOpportunity: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/lib/openings/queries', () => ({
  fetchExpected: jest.fn(),
  fetchOpportunities: jest.fn(),
  fetchLiveFeed: jest.fn(),
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
  getOaPrep: jest.fn(),
  getDuels: jest.fn(),
  createDuel: jest.fn(),
  getDuel: jest.fn(),
  actOnDuel: jest.fn(),
  getCourse: jest.fn(),
  getCourseModule: jest.fn(),
  askTutor: jest.fn(),
  revealSolution: jest.fn(),
  getInterviewPrep: jest.fn(),
  prepQuestions: jest.fn(),
  scoreAnswer: jest.fn(),
  followUp: jest.fn(),
  getMockInterviews: jest.fn(),
  saveMockInterview: jest.fn(),
  getCvRater: jest.fn(),
  rateCv: jest.fn(),
  getCoverLetter: jest.fn(),
  draftLetter: jest.fn(),
  reviewLetter: jest.fn(),
  getPsBuilder: jest.fn(),
  reviewStatement: jest.fn(),
  brainstormStatement: jest.fn(),
  saveStatement: jest.fn(() => Promise.resolve({ ok: true })),
  getStudyCoach: jest.fn(),
  askStudyCoach: jest.fn(),
  markStudyEssay: jest.fn(),
}));
jest.mock('@/lib/pick-cv', () => ({
  pickCv: jest.fn(() => Promise.resolve({ fileName: 'cv.pdf', fileBase64: 'JVBERi0=' })),
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

const APPLICATION = {
  id: 'app-1',
  job_id: ID,
  kind: 'internship',
  status: 'applied',
  stage_completed_at: null,
  applied_on: '2026-11-01',
  updated_at: '2026-11-01T00:00:00Z',
  manual_company: null,
  manual_title: null,
  manual_url: null,
  starred: false,
  jobs: { ...OPENING },
};

const EXPECTED = {
  id: 'exp-1',
  company_name: 'Jane Street',
  programme_type: 'spring_week',
  last_opened_at: '2025-09-01T09:00:00Z',
  last_cycle: 2026,
  evidence_source: 'first_party',
  expected_on: '2099-09-01',
  expected_from: '2099-08-22',
  expected_to: '2099-09-11',
  confidence: 'high' as const,
};

const OPPORTUNITY = {
  id: 'opp-1',
  name: 'Iris Hacks IV',
  organiser: 'Iris Hacks',
  kind: 'hackathon' as const,
  description: 'A weekend hackathon.',
  url: 'https://iris-hacks.devpost.com/',
  location: 'Online',
  event_date: null,
  deadline: '2099-08-09T23:59:59Z',
  created_at: '2026-08-09T06:15:13Z',
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
  jest.mocked(Applications.fetchApplications).mockResolvedValue([APPLICATION] as never);
  jest.mocked(Applications.fetchApplicationForJob).mockResolvedValue(null);
  jest.mocked(Applications.fetchSavedOpportunityUrls).mockResolvedValue(new Set());
  jest.mocked(Boards.fetchExpected).mockResolvedValue([EXPECTED]);
  jest.mocked(Boards.fetchOpportunities).mockResolvedValue([OPPORTUNITY]);
  jest.mocked(Boards.fetchLiveFeed).mockResolvedValue([{ ...OPENING, first_seen_at: new Date().toISOString() }] as never);
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
  const app = await renderRouter('./src/app', { initialUrl: url });
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
    expect(screen.getByText('Sign in to simplytk')).toBeTruthy();
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

  it('keeps the email form tucked away while quicker ways are offered', async () => {
    setSessionForTests(null);
    jest.spyOn(Platform, 'Version', 'get').mockReturnValue('18.2');
    await launch();
    expect(screen.queryByLabelText('Password')).toBeNull();
    await press('Use email or phone');
    expect(screen.getByLabelText('Password')).toBeTruthy();
    await press('Other ways to sign in');
    expect(screen.getByText('Continue with Google')).toBeTruthy();
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
    await press('Create an account');
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
    expect(screen.getAllByText('Day streak').length).toBeGreaterThan(0);
    expect(screen.getByText('Keep your 6-day streak')).toBeTruthy();
    expect(screen.getAllByText('#4').length).toBeGreaterThan(0);
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
    // The first "Spring week" is the filter chip; cards below show the type too.
    await act(async () => {
      fireEvent.press(screen.getAllByText('Spring week')[0]);
    });
    await flush();
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

describe('My applications', () => {
  it('lists tracked applications by stage and moves one on', async () => {
    const { app } = await launch('/more');
    await press('My applications');
    expect(app.getPathname()).toBe('/applications');
    // The section header and the row's stage pill.
    expect(screen.getAllByText('Applied').length).toBeGreaterThanOrEqual(2);
    await act(async () => {
      fireEvent.press(screen.getAllByText('Applied').at(-1)!);
    });
    await flush();
    await press('Interview');
    expect(Applications.setStage).toHaveBeenCalledWith(expect.objectContaining({ id: 'app-1' }), 'interview');
  });

  it('tracks an opening from its screen', async () => {
    await launch(`/opening/${ID}`);
    await press('Track application');
    await press('Applied');
    expect(Applications.trackOpening).toHaveBeenCalledWith(ID, 'applied');
  });
});

describe('boards', () => {
  it('shows when programmes are expected to open', async () => {
    await launch('/opening-soon');
    expect(screen.getByText('Jane Street')).toBeTruthy();
    expect(screen.getByText('22 Aug to 11 Sep')).toBeTruthy();
  });

  it('shows the live feed', async () => {
    await launch('/live');
    expect(screen.getAllByText('Today').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Detected \d\d:\d\d · New$/).length).toBe(1);
  });

  it('saves a startup opportunity to the tracker', async () => {
    await launch('/opportunities');
    expect(screen.getByText('Iris Hacks IV')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Save Iris Hacks IV'));
    });
    await flush();
    expect(Applications.saveOpportunity).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://iris-hacks.devpost.com/' }));
  });

  it('opens the pre-uni tracker from More', async () => {
    await launch('/more');
    await press('Pre-uni tracker');
    expect(Queries.fetchOpenings).toHaveBeenLastCalledWith(expect.objectContaining({ stage: 'preuni', types: [] }), 0);
  });

  it('shows progress', async () => {
    await launch('/progress');
    expect(screen.getByText('Interviews')).toBeTruthy();
    expect(screen.getByText('#4 in the Silver league')).toBeTruthy();
  });
});

const DUEL = {
  code: 'ab12cd34',
  game: 'mental-maths',
  label: 'Mental maths',
  path: '/drills/mental-maths',
  lowerIsBetter: false,
  createdAt: '2026-11-10T09:00:00Z',
  acceptedAt: null,
  cancelledAt: null,
  expiresAt: '2099-01-01T00:00:00Z',
  status: 'open' as const,
  result: null,
  walkover: false,
  challenger: { username: 'sam', isYou: false, score: 41, scoreText: '41 correct', playedAt: '2026-11-10T09:05:00Z' },
  opponent: null,
  yourRole: 'spectator' as const,
  link: 'https://simplytk.com/1v1/ab12cd34',
};

const COURSE_MODULE = {
  id: 'accounting-linkage',
  title: 'Linking the three statements',
  objectives: ['Walk a change through all three statements'],
  explainer: 'Every IB interview tests the three statements.',
  drills: [{ label: 'Accounting MCQ drill', to: '/practice', practiceTopic: 'accounting' }],
  questions: [{ id: 'acc-1', difficulty: 'easy' as const, prompt: 'Depreciation goes up by 10. Walk me through it.' }],
};

describe('practice', () => {
  beforeEach(() => {
    jest.mocked(SiteApi.getOaPrep).mockResolvedValue({
      since: '2026-09-01',
      firms: [{ firm: 'Goldman Sachs', provider: 'HireVue', sends: 'A numerical test', games: [], reported: null }],
      providers: [],
      assessments: [],
      plan: [],
      faqs: [],
    });
    jest.mocked(SiteApi.getDuels).mockResolvedValue({
      games: [{ key: 'mental-maths', label: 'Mental maths', path: '/drills/mental-maths', lowerIsBetter: false }],
      duels: [],
    });
    jest.mocked(SiteApi.createDuel).mockResolvedValue({ code: 'ab12cd34' });
    jest.mocked(SiteApi.getDuel).mockResolvedValue(DUEL);
    jest.mocked(SiteApi.actOnDuel).mockResolvedValue({
      ...DUEL,
      status: 'live',
      yourRole: 'opponent',
      opponent: { username: 'you', isYou: true, score: null, scoreText: null, playedAt: null },
    });
    jest.mocked(SiteApi.getCourse).mockResolvedValue({
      tracks: [
        {
          id: 'ib',
          label: 'Investment banking',
          description: 'Technical and fit questions.',
          modules: [{ id: COURSE_MODULE.id, title: COURSE_MODULE.title, objectives: [], drills: [], questionCount: 1 }],
        },
      ],
      progress: [],
    });
    jest.mocked(SiteApi.getCourseModule).mockResolvedValue(COURSE_MODULE);
    jest.mocked(SiteApi.askTutor).mockResolvedValue({ band: 4, feedback: 'Right order, check the tax.', socraticQuestion: null, hint: 'Think about tax.' });
  });

  it('shows the OA prep guide', async () => {
    await launch('/oa-prep');
    expect(screen.getAllByText('Goldman Sachs').length).toBeGreaterThan(0);
  });

  it('starts a 1v1 and opens it', async () => {
    await launch('/duels');
    await press('Challenge on Mental maths');
    expect(SiteApi.createDuel).toHaveBeenCalledWith('mental-maths');
    expect(SiteApi.getDuel).toHaveBeenCalledWith('ab12cd34');
  });

  it('accepts a 1v1 from its link', async () => {
    await launch('/duels/ab12cd34');
    expect(screen.getByText('41 correct')).toBeTruthy();
    await press('Accept the challenge');
    expect(SiteApi.actOnDuel).toHaveBeenCalledWith('ab12cd34', 'accept');
    expect(screen.getByText('Play Mental maths')).toBeTruthy();
  });

  it('falls back to the web page while the website lacks the route', async () => {
    jest.mocked(SiteApi.getDuels).mockRejectedValue(new SiteApi.SiteApiMissing('/api/app/duels'));
    await launch('/duels');
    expect(screen.getByText('Coming to the app soon')).toBeTruthy();
  });

  it('marks a course answer with the tutor', async () => {
    await launch('/course');
    await press('Linking the three statements');
    expect(screen.getByText('Every IB interview tests the three statements.')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Question 1'));
    });
    await flush();
    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Your answer to question 1'), 'Net income falls by 6 after tax.');
    });
    await press('Get AI feedback');
    expect(SiteApi.askTutor).toHaveBeenCalledWith('acc-1', 'Net income falls by 6 after tax.');
    expect(screen.getByText('Band 4/5 · Nearly there')).toBeTruthy();
  });
});

const QUOTA = { pass: false, freePerDay: 1, freeLeft: 1, credits: 0, quickPerDay: 2, quickLeft: 3 };
const LONG_ANSWER = 'I led a team of four on a fundraising project and we raised two thousand pounds for charity.';

async function type(label: string, text: string) {
  await act(async () => {
    fireEvent.changeText(screen.getByLabelText(label), text);
  });
}

describe('AI tools', () => {
  beforeEach(() => {
    jest.mocked(SiteApi.getInterviewPrep).mockResolvedValue({
      programmes: [{ key: 'spring_week', label: 'Spring week' }],
      sectors: [{ key: 'investment_banking', label: 'Investment banking' }],
      bank: { investment_banking: [{ category: 'fit', question: 'Why banking?', whatTheyTest: 'Motivation', tip: 'Be specific.' }] },
    });
    jest.mocked(SiteApi.prepQuestions).mockResolvedValue([
      { question: 'Why Goldman Sachs?', whatTheyTest: 'Motivation for the firm', tip: 'Name a deal.' },
    ]);
    jest.mocked(SiteApi.scoreAnswer).mockResolvedValue({
      score: 7,
      verdict: 'Clear, but generic.',
      feedback: ['Name the firm’s business.'],
      improvedAnswer: 'A stronger answer.',
    });
    jest.mocked(SiteApi.followUp).mockResolvedValue({ question: 'What did you do yourself?', why: 'Ownership' });
    jest.mocked(SiteApi.getMockInterviews).mockResolvedValue({ pass: false, sessions: [] });
    jest.mocked(SiteApi.saveMockInterview).mockResolvedValue({ saved: false });
    jest.mocked(SiteApi.getCvRater).mockResolvedValue({
      quota: QUOTA,
      history: [],
      sectors: [{ key: 'investment_banking', label: 'Investment banking' }],
      username: 'sam',
    });
    jest.mocked(SiteApi.rateCv).mockResolvedValue({
      ratingId: 'r1',
      score: 74,
      categories: [{ name: 'Impact', score: 6, comment: 'Add numbers.' }],
      strengths: ['Clear layout'],
      improvements: ['Quantify results'],
      bulletRewrites: [],
      atsChecks: [],
      jobMatch: null,
      ranked: true,
      previousBest: null,
      percentile: 81,
      rank: 12,
      totalStudents: 300,
    });
    jest.mocked(SiteApi.getCoverLetter).mockResolvedValue({
      quota: { drafts: QUOTA, reviews: QUOTA },
      sectors: [{ key: 'general', label: 'General' }],
      levels: [{ key: 'internship', label: 'Internship' }],
      cvs: [{ id: 'r1', fileName: 'cv.pdf', targetRole: 'Spring week', score: 74, createdAt: '2026-11-01T00:00:00Z' }],
      username: 'sam',
    });
    jest.mocked(SiteApi.draftLetter).mockResolvedValue({
      letter: 'Dear Hiring Team, ...',
      wordCount: 4,
      openings: [],
      usedFromCv: ['Fundraising project'],
      gaps: ['[name a recent deal]'],
    });
    jest.mocked(SiteApi.getPsBuilder).mockResolvedValue({
      questions: ['Why this course?', 'How have your studies prepared you?', 'What else have you done?'],
      totalLimit: 4000,
      minPerAnswer: 350,
      quota: QUOTA,
      draft: { course: 'Economics', universities: 'LSE', answers: ['a'.repeat(400), '', ''], updatedAt: '2026-11-01T00:00:00Z' },
    });
    jest.mocked(SiteApi.reviewStatement).mockResolvedValue({
      overallScore: 6,
      tutorSummary: 'A solid start.',
      questionFeedback: [],
      cohesion: null,
      repetition: [],
      courseFit: [],
      nextActions: ['Add a book you read.'],
    });
    jest.mocked(SiteApi.getStudyCoach).mockResolvedValue({
      levels: [{ key: 'a_level', label: 'A-Level' }],
      subjects: ['Economics'],
      boards: ['AQA'],
      progress: { recent: [], weakTopics: [] },
    });
    jest.mocked(SiteApi.askStudyCoach).mockResolvedValue({ reply: 'Start with a judgement.' });
  });

  it('marks a firm prep answer', async () => {
    await launch('/interview-prep');
    await type('Firm', 'Goldman Sachs');
    await press('Get my questions');
    expect(SiteApi.prepQuestions).toHaveBeenCalledWith('Goldman Sachs', 'spring_week', 'investment_banking');
    await act(async () => {
      fireEvent.press(screen.getAllByLabelText('Question 1')[0]);
    });
    await type('Your answer', LONG_ANSWER);
    await press('Mark my answer');
    expect(SiteApi.scoreAnswer).toHaveBeenCalledWith('Goldman Sachs', 'Why Goldman Sachs?', LONG_ANSWER);
    expect(screen.getByText('Clear, but generic.')).toBeTruthy();
  });

  it('runs a mock interview with its follow-up', async () => {
    await launch('/mock-interview');
    await type('Firm', 'Goldman Sachs');
    await press('Start the interview');
    expect(screen.getByText('Why Goldman Sachs?')).toBeTruthy();
    await type('Your answer', LONG_ANSWER);
    await press('Submit answer');
    expect(screen.getByText('What did you do yourself?')).toBeTruthy();
    await press('Finish the interview');
    await press('Save to my history');
    expect(SiteApi.saveMockInterview).toHaveBeenCalledWith(
      expect.objectContaining({ company: 'Goldman Sachs', rounds: [expect.objectContaining({ score: 7, transcript: LONG_ANSWER })] }),
    );
  });

  it('rates a CV picked from Files', async () => {
    await launch('/cv-rater');
    await press('Choose your CV');
    await type('Role you’re targeting', 'Spring week');
    await press('Rate my CV');
    expect(SiteApi.rateCv).toHaveBeenCalledWith(expect.objectContaining({ fileName: 'cv.pdf', targetRole: 'Spring week' }));
    expect(screen.getByText('Add numbers.')).toBeTruthy();
  });

  it('drafts a cover letter from a rated CV', async () => {
    await launch('/cover-letter');
    await type('Employer', 'Deloitte');
    await type('Role', 'Audit intern');
    await press('Write my draft');
    expect(SiteApi.draftLetter).toHaveBeenCalledWith(expect.objectContaining({ company: 'Deloitte', cvRatingId: 'r1' }));
    expect(screen.getByText('Dear Hiring Team, ...')).toBeTruthy();
  });

  it('loads the saved statement and reviews it', async () => {
    await launch('/ps-builder');
    expect(screen.getByDisplayValue('Economics')).toBeTruthy();
    await press('Review my statement');
    expect(SiteApi.reviewStatement).toHaveBeenCalledWith(expect.objectContaining({ course: 'Economics' }));
    expect(screen.getByText('A solid start.')).toBeTruthy();
  });

  it('asks the study coach', async () => {
    await launch('/study-coach');
    await type('Ask anything on AQA Economics', 'How do I evaluate?');
    await press('Send');
    expect(SiteApi.askStudyCoach).toHaveBeenCalledWith({ level: 'a_level', subject: 'Economics', board: 'AQA' }, [
      { role: 'user', content: 'How do I evaluate?' },
    ]);
    expect(screen.getByText('Start with a judgement.')).toBeTruthy();
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
    expect(page.props.applicationNameForUserAgent).toMatch(/^simplytk-app\/\d+\.\d+\.\d+ simplytk-ios-app$/);
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
    await press('Resources');
    expect(app.getPathname()).toBe('/page');
    expect(app.getSearchParams()).toMatchObject({ path: '/resources', title: 'Resources' });
    expect(uris()).toContain('https://simplytk.com/resources');
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
      .mockReturnValueOnce(tap({ url: 'https://simplytk.com/resources' }) as never);
    const { app } = await launch();
    expect(app.getPathname()).toBe('/page');
    expect(uris()).toContain('https://simplytk.com/resources');
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
