import { getSession } from '@/lib/session';
import { SITE_ORIGIN } from '@/lib/site';

/**
 * The website's app endpoints (docs/app-api.md). They wrap the same server code the site's
 * own pages use, so a daily run, a streak or a league place is the same in both places.
 * Every call carries the student's Supabase access token.
 */

/** The endpoint isn't on the live site yet: screens fall back to the web page. */
export class SiteApiMissing extends Error {
  constructor(path: string) {
    super(`${path} is not on simplytk.com yet`);
    this.name = 'SiteApiMissing';
  }
}

async function call<T>(method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const token = getSession()?.access_token;
  const response = await fetch(`${SITE_ORIGIN}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  // A path the site doesn't serve renders its HTML 404 page rather than JSON.
  const isJson = (response.headers.get('content-type') ?? '').includes('application/json');
  if (response.status === 404 && !isJson) throw new SiteApiMissing(path);
  const payload = isJson ? await response.json().catch(() => null) : null;
  if (!response.ok) {
    const message = payload && typeof payload.error === 'string' ? payload.error : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return payload as T;
}

// ---- Daily challenge ---------------------------------------------------------------------

export type Frac = { n: number; d: number };

export type DailyProblem =
  | { kind: 'sequence'; terms: string[]; answer: Frac; id: number }
  | { kind: 'mental_maths'; text: string; answer: number }
  | { kind: 'fast_fractions'; numerator: number; denominator: number; answer: string; options?: string[] }
  | {
      kind: 'sprint';
      id: string;
      type: string;
      prompt: string;
      options: string[];
      answer: number;
      explanation: string;
    };

export type DailyResult = {
  score: number;
  total: number;
  durationMs: number;
  detail: ('c' | 'w' | 's')[];
};

export type DailyState = {
  day: string;
  number: number;
  total: number;
  result: DailyResult | null;
  sessionId: string | null;
  problems: DailyProblem[] | null;
};

export type AnswerEvent = { i: number; a: string; t: number };

export type StreakDay = { day: string; played: boolean; frozen?: boolean };

export type Streak = {
  current: number;
  best: number;
  playedToday: boolean;
  atRisk: boolean;
  week: StreakDay[];
  freezesLeft: number;
};

export const getDaily = () => call<DailyState>('GET', '/api/app/daily');

export const submitDaily = (sessionId: string, answers: AnswerEvent[]) =>
  call<DailyResult>('POST', '/api/app/daily', { sessionId, answers });

export const getStreak = () => call<Streak>('GET', '/api/app/streak');

// ---- Leaderboards ------------------------------------------------------------------------

export type BoardEntry = {
  rank: number;
  username: string | null;
  isYou: boolean;
  university: string | null;
  /** Daily: questions right. Overall: points across every ranked drill. */
  score: number;
  /** Daily only: time taken. */
  durationMs?: number;
};

export type Board = {
  entries: BoardEntry[];
  players: number;
  /** The student's own row, also when it is below the entries shown. */
  you: BoardEntry | null;
};

export type DailyPeriod = 'today' | 'month' | 'all';
export type OverallPeriod = 'all' | 'month';

export const getDailyBoard = (period: DailyPeriod) =>
  call<Board>('GET', `/api/app/leaderboard?board=daily&period=${period}`);

export const getOverallBoard = (period: OverallPeriod) =>
  call<Board>('GET', `/api/app/leaderboard?board=overall&period=${period}`);

export type LeagueTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
export type LeagueZone = 'promote' | 'stay' | 'demote';

export type LeagueMember = {
  rank: number;
  points: number;
  zone: LeagueZone;
  username: string | null;
  isYou: boolean;
  university: string | null;
};

export type League = {
  weekStart: string;
  endsAt: string;
  tier: LeagueTier;
  cohort: number;
  members: LeagueMember[];
  you: { rank: number; points: number; zone: LeagueZone };
  lastWeek: { tier: LeagueTier; rank: number; points: number; outcome: string; members: number } | null;
};

export const getLeague = () => call<League>('GET', '/api/app/league');

// ---- Push --------------------------------------------------------------------------------

export const savePushToken = (token: string, platform: 'ios' | 'android') =>
  call<{ ok: true }>('POST', '/api/app/push-tokens', { token, platform });

export const deletePushToken = (token: string) => call<{ ok: true }>('DELETE', '/api/app/push-tokens', { token });
