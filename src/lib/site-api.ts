import { getSession } from '@/lib/session';
import { SITE_ORIGIN } from '@/lib/site';
import { supabase } from '@/lib/supabase';

/**
 * The website's app endpoints (docs/app-api.md, and docs/native-app-api.md in the site's repo). They wrap the same server code the site's
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

/**
 * A current access token. Coming back to the app after an hour, screens ask for data before
 * the auto-refresh has run, so an expired token is refreshed first rather than sent.
 */
async function accessToken(): Promise<string | undefined> {
  const cached = getSession();
  if (!cached) return undefined;
  const expiresAt = (cached.expires_at ?? 0) * 1000;
  if (expiresAt - Date.now() > 60_000) return cached.access_token;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? cached.access_token;
  } catch {
    return cached.access_token;
  }
}

async function call<T>(method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const token = await accessToken();
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

/**
 * The phone's IANA zone. The site counts the daily challenge's day, the streak and the
 * board periods in it (UTC without it), so a student abroad rolls over at their midnight.
 */
export function phoneTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

/** `path` with `params` and the phone's zone as a query string. */
export function withZone(path: string, params: Record<string, string> = {}): string {
  const tz = phoneTimeZone();
  const query = Object.entries(tz ? { ...params, tz } : params)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');
  return query ? `${path}?${query}` : path;
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

export const getDaily = () => call<DailyState>('GET', withZone('/api/app/daily'));

export const submitDaily = (sessionId: string, answers: AnswerEvent[]) =>
  call<DailyResult>('POST', '/api/app/daily', { sessionId, answers, tz: phoneTimeZone() });

export const getStreak = () => call<Streak>('GET', withZone('/api/app/streak'));

// ---- Leaderboards ------------------------------------------------------------------------

/** A row as the app draws it, for players and universities alike. */
export type BoardEntry = {
  rank: number;
  username: string | null;
  isYou: boolean;
  university: string | null;
  /** Players: questions right (points on month and all-time). Universities: points. Null when unknown. */
  score: number | null;
  /** Players' daily runs only: time taken. */
  durationMs?: number;
  /** A second line instead of the university, such as a university's member count. */
  detail?: string;
};

export type Board = {
  entries: BoardEntry[];
  players: number;
  /** The student's own row, also when it is below the entries shown. */
  you: BoardEntry | null;
};

export type DailyPeriod = 'today' | 'month' | 'all';

/** The site's daily board, as GET /api/app/leaderboard returns it. Top 100. */
export type SiteDailyBoard = {
  day: string;
  number: number;
  entries: {
    rank: number;
    username: string | null;
    score: number;
    durationMs: number;
    isYou: boolean;
    university: string | null;
    linkedin: string | null;
    days?: number;
  }[];
  players: number;
  yourRank: number | null;
  /** Share of the period's players you beat or tied, 0 to 100. */
  percentile: number | null;
};

export type SiteUniversityBoard = {
  entries: { rank: number; university: string; points: number; members: number; isYours: boolean }[];
  yourUniversity: string | null;
};

export type Leaderboards = { period: DailyPeriod; board: SiteDailyBoard; universities: SiteUniversityBoard };

export const getLeaderboards = (period: DailyPeriod) =>
  call<Leaderboards>('GET', withZone('/api/app/leaderboard', { period }));

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
  call<{ ok: true; provider: string }>('POST', '/api/app/push-token', { token, platform });

export const deletePushToken = (token: string) => call<{ ok: true }>('DELETE', '/api/app/push-token', { token });

// ---- Online assessment prep ------------------------------------------------------------------

export type GameLink = { label: string; to: string };

export type OaFirm = {
  firm: string;
  provider: string;
  sends: string;
  games: GameLink[];
  /** What students reported this cycle, or null. */
  reported: { reports: number; line: string } | null;
};

export type OaProvider = { provider: string; alsoCalled: string; firms: string; games: GameLink[] };

export type OaAssessment = {
  name: string;
  provider: string;
  format: string;
  timing: string;
  caveat: string;
  practise: string;
  to?: string;
  toLabel?: string;
};

export type OaPrepGuide = {
  since: string;
  firms: OaFirm[];
  providers: OaProvider[];
  assessments: OaAssessment[];
  plan: { when: string; title: string; body: string }[];
  faqs: { q: string; a: string }[];
};

export const getOaPrep = () => call<OaPrepGuide>('GET', '/api/app/oa-prep');

// ---- 1v1 challenges ------------------------------------------------------------------------

export type DuelGame = { key: string; label: string; path: string; lowerIsBetter: boolean };

export type DuelStatus = 'open' | 'live' | 'settled' | 'void' | 'cancelled';

export type DuelSide = {
  username: string | null;
  isYou: boolean;
  score: number | null;
  scoreText: string | null;
  playedAt: string | null;
};

export type Duel = {
  code: string;
  game: string;
  label: string;
  path: string;
  lowerIsBetter: boolean;
  createdAt: string;
  acceptedAt: string | null;
  cancelledAt: string | null;
  expiresAt: string;
  status: DuelStatus;
  result: 'challenger' | 'opponent' | 'draw' | null;
  walkover: boolean;
  challenger: DuelSide;
  opponent: DuelSide | null;
  yourRole: 'challenger' | 'opponent' | 'spectator';
  link: string;
};

export const getDuels = () => call<{ games: DuelGame[]; duels: Duel[] }>('GET', '/api/app/duels');
export const createDuel = (game: string) => call<{ code: string }>('POST', '/api/app/duels', { game });
export const getDuel = (code: string) => call<Duel>('GET', `/api/app/duels/${encodeURIComponent(code)}`);
export const actOnDuel = (code: string, action: 'accept' | 'cancel') =>
  call<Duel>('POST', `/api/app/duels/${encodeURIComponent(code)}`, { action });

// ---- Interview course ----------------------------------------------------------------------

export type CourseDrill = { label: string; to: string; practiceTopic?: string };

export type CourseModuleSummary = {
  id: string;
  title: string;
  objectives: string[];
  drills: CourseDrill[];
  questionCount: number;
};

export type CourseTrack = { id: string; label: string; description: string; modules: CourseModuleSummary[] };

export type CourseModule = {
  id: string;
  title: string;
  objectives: string[];
  explainer: string;
  drills: CourseDrill[];
  questions: { id: string; difficulty: 'easy' | 'medium' | 'hard'; prompt: string }[];
};

export type TutorResult = { band: number; feedback: string; socraticQuestion: string | null; hint: string };

export const getCourse = () =>
  call<{ tracks: CourseTrack[]; progress: { questionId: string; band: number }[] }>('GET', '/api/app/course');
export const getCourseModule = (id: string) => call<CourseModule>('GET', `/api/app/course?module=${encodeURIComponent(id)}`);
export const askTutor = (questionId: string, answer: string) =>
  call<TutorResult>('POST', '/api/app/course/tutor', { questionId, answer });
export const revealSolution = (questionId: string, gaveUp: boolean) =>
  call<{ solution: string }>('POST', '/api/app/course/solution', { questionId, gaveUp });

// ---- AI tools -------------------------------------------------------------------------------

export type Option = { key: string; label: string };

/** A tool's allowance today: full-depth runs, then quick ones on a faster model. */
export type AiQuota = { pass: boolean; freePerDay: number; freeLeft: number; credits: number; quickPerDay: number; quickLeft: number };

/** "quick" when a run went to the faster model after the day's full-depth ones. */
export type AiTier = 'premium' | 'full' | 'quick';

// Firm prep and the mock interview.
export type BankQuestion = { category: 'fit' | 'behavioural'; question: string; whatTheyTest: string; tip: string };
export type PrepQuestion = { question: string; whatTheyTest: string; tip: string };
export type AnswerFeedback = { score: number; verdict: string; feedback: string[]; improvedAnswer: string };
export type FollowUp = { question: string; why: string };

export const getInterviewPrep = () =>
  call<{ programmes: Option[]; sectors: Option[]; bank: Record<string, BankQuestion[]> }>('GET', '/api/app/interview-prep');
export const prepQuestions = (company: string, programme: string, sector: string) =>
  call<PrepQuestion[]>('POST', '/api/app/interview-prep', { action: 'questions', company, programme, sector });
export const scoreAnswer = (company: string, question: string, answer: string) =>
  call<AnswerFeedback>('POST', '/api/app/interview-prep', { action: 'score', company, question, answer });
export const followUp = (company: string, question: string, answer: string) =>
  call<FollowUp>('POST', '/api/app/interview-prep', { action: 'follow-up', company, question, answer });

export type MockRound = {
  question: string;
  whatTheyTest: string;
  transcript: string;
  seconds: number;
  score: number | null;
  verdict: string | null;
  feedback: string[];
  delivery: null;
  followUp: { question: string; transcript: string; score: number | null; verdict: string | null } | null;
};
export type SavedMockInterview = {
  id: string;
  company: string | null;
  sector: string | null;
  programme: string | null;
  averageScore: number | null;
  rounds: MockRound[];
  createdAt: string;
};
export const getMockInterviews = () => call<{ pass: boolean; sessions: SavedMockInterview[] }>('GET', '/api/app/mock-interviews');
export const saveMockInterview = (interview: { company: string; sector: string; programme: string; rounds: MockRound[] }) =>
  call<{ saved: boolean }>('POST', '/api/app/mock-interviews', interview);

// The CV rater.
export type CvHistoryPoint = { id: string; score: number; targetRole: string; fileName: string; createdAt: string; againstAdvert: boolean };
export type CvRating = {
  ratingId: string | null;
  score: number;
  categories: { name: string; score: number; comment: string }[];
  strengths: string[];
  improvements: string[];
  bulletRewrites: { original: string; improved: string; why: string }[];
  atsChecks: { name: string; passed: boolean; detail: string }[];
  jobMatch: { met: string[]; missing: string[] } | null;
  ranked: boolean;
  previousBest: number | null;
  percentile: number;
  rank: number;
  totalStudents: number;
  tier?: AiTier;
};
export type UploadedFile = { fileName: string; fileBase64: string };

export const getCvRater = () =>
  call<{ quota: AiQuota; history: CvHistoryPoint[]; sectors: Option[]; username: string | null }>('GET', '/api/app/cv-rater');
export const rateCv = (
  input: UploadedFile & { targetRole: string; sector: string; targetCompany: string; jobDescription: string; username: string },
) => call<CvRating>('POST', '/api/app/cv-rater', input);

// The cover letter tool.
export type LetterTarget = { company: string; role: string; sector: string; level: string; jobDescription: string };
export type SavedCv = { id: string; fileName: string; targetRole: string; score: number; createdAt: string };
export type LetterDraft = { letter: string; wordCount: number; openings: string[]; usedFromCv: string[]; gaps: string[]; tier?: AiTier };
export type LetterReview = {
  score: number;
  verdict: string;
  wordCount: number;
  categories: { key: string; name: string; score: number; comment: string }[];
  checks: { name: string; passed: boolean; detail: string }[];
  cliches: { phrase: string; kind: 'cliche' | 'ai'; fix: string }[];
  flags: string[];
  genericLines: string[];
  rewrites: { original: string; improved: string; why: string }[];
  nextActions: string[];
  percentile: number;
  rank: number;
  totalReviewed: number;
  tier?: AiTier;
};

export const getCoverLetter = () =>
  call<{
    quota: { drafts: AiQuota; reviews: AiQuota };
    sectors: Option[];
    levels: Option[];
    cvs: SavedCv[];
    username: string | null;
  }>('GET', '/api/app/cover-letter');
export const draftLetter = (input: LetterTarget & { notes: string } & ({ cvRatingId: string } | UploadedFile)) =>
  call<LetterDraft>('POST', '/api/app/cover-letter', { action: 'draft', ...input });
export const reviewLetter = (input: LetterTarget & { letter: string; username: string }) =>
  call<LetterReview>('POST', '/api/app/cover-letter', { action: 'review', ...input });

// The personal statement builder.
export type PsDraft = { course: string; universities: string; answers: string[]; updatedAt: string };
export type PsReview = {
  overallScore: number;
  tutorSummary: string;
  questionFeedback: { question: number; score: number; verdict: string; strengths: string[]; improvements: string[]; cliches: string[] }[];
  cohesion: { score: number; verdict: string; notes: string[] } | null;
  repetition: string[];
  courseFit: string[];
  nextActions: string[];
  tier?: AiTier;
};
export type PsIdea = { experience: string; question: number; angle: string };
type PsInput = { course: string; universities: string; answers: string[] };

export const getPsBuilder = () =>
  call<{ questions: string[]; totalLimit: number; minPerAnswer: number; quota: AiQuota; draft: PsDraft | null }>(
    'GET',
    '/api/app/ps-builder',
  );
export const reviewStatement = (input: PsInput) => call<PsReview>('POST', '/api/app/ps-builder', { action: 'review', ...input });
export const brainstormStatement = (course: string, experiences: string) =>
  call<PsIdea[]>('POST', '/api/app/ps-builder', { action: 'brainstorm', course, experiences });
export const saveStatement = (input: PsInput) => call<{ ok: true }>('POST', '/api/app/ps-builder', { action: 'save', ...input });

// The Study Coach.
export type StudyContext = { level: string; subject: string; board: string };
export type ChatTurn = { role: 'user' | 'tutor'; content: string };
export type EssayMark = {
  awardedMarks: number;
  totalMarks: number;
  band: string;
  topic: string;
  aoScores: { name: string; score: number; outOf: number; comment: string }[];
  strengths: string[];
  improvements: string[];
  examinerSummary: string;
};
export type StudyProgress = {
  recent: { subject: string; topic: string; awarded: number; total: number; createdAt: string }[];
  weakTopics: { topic: string; subject: string; attempts: number; averagePercent: number }[];
};

export const getStudyCoach = () =>
  call<{ levels: Option[]; subjects: string[]; boards: string[]; progress: StudyProgress }>('GET', '/api/app/study-coach');
export const askStudyCoach = (context: StudyContext, messages: ChatTurn[]) =>
  call<{ reply: string }>('POST', '/api/app/study-coach', { action: 'chat', ...context, messages });
export const markStudyEssay = (context: StudyContext & { question: string; totalMarks: number; essay: string }) =>
  call<EssayMark>('POST', '/api/app/study-coach', { action: 'mark', ...context });
