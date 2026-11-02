import type { AnswerEvent, DailyProblem, Frac } from '@/lib/site-api';

/**
 * The daily challenge, played natively. The website issues the day's questions and marks
 * the run itself from the answer events (src/lib/oa-sessions.ts `verifyDailyAnswers`), so
 * the checks here only drive the instant right/wrong feedback. They mirror the site's
 * rules closely enough that the two agree on every answer the keypad can type.
 */

/** The site's marker for a skipped question. */
export const SKIP = '!skip';

/** The site rejects answers less than 200 ms apart as not human-paced. */
export const MIN_GAP_MS = 200;

export type InputMode =
  /** Typed on the number pad. `fraction` adds the / key, for sequences. */
  | { kind: 'number'; fraction: boolean }
  | { kind: 'choice'; options: string[] };

export function inputModeFor(problem: DailyProblem): InputMode {
  switch (problem.kind) {
    case 'sprint':
      return { kind: 'choice', options: problem.options };
    case 'fast_fractions':
      return problem.options?.length ? { kind: 'choice', options: problem.options } : { kind: 'number', fraction: false };
    case 'sequence':
      return { kind: 'number', fraction: true };
    default:
      return { kind: 'number', fraction: false };
  }
}

export type Prompt = { kicker: string; text: string };

export function promptFor(problem: DailyProblem): Prompt {
  switch (problem.kind) {
    case 'sequence':
      return { kicker: 'Next in the sequence', text: `${problem.terms.join(', ')}, ?` };
    case 'mental_maths':
      return { kicker: 'Mental maths', text: problem.text };
    case 'fast_fractions':
      return { kicker: 'As a decimal', text: `${problem.numerator}/${problem.denominator}` };
    case 'sprint':
      return { kicker: sprintKicker(problem.type), text: problem.prompt };
  }
}

function sprintKicker(type: string): string {
  const labels: Record<string, string> = {
    analogy: 'Analogy',
    vocabulary: 'Vocabulary',
    disarranged: 'Unscramble',
    proverb: 'Proverb',
    arithmetic: 'Arithmetic',
    series: 'Series',
    comparison: 'Comparison',
    dates: 'Dates',
    deduction: 'Deduction',
    spatial: 'Spatial',
  };
  return labels[type] ?? 'Reasoning';
}

/** What the number pad accepts, at most 20 characters. */
export function sanitiseNumber(value: string, fraction: boolean): string {
  const allowed = fraction ? /[^0-9\-/.]/g : /[^0-9\-.]/g;
  return value.replace(allowed, '').slice(0, 20);
}

/** One key press on the number pad. */
export function applyKey(value: string, key: string, fraction: boolean): string {
  if (key === 'back') return value.slice(0, -1);
  if (key === '-') return value.startsWith('-') ? value.slice(1) : `-${value}`;
  if (key === '.' && /\.\d*$/.test(value.split('/').pop() ?? '')) return value;
  if (key === '/' && (!fraction || value.includes('/') || value === '' || value === '-')) return value;
  return sanitiseNumber(value + key, fraction);
}

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

/** Parse "12", "-3", "2.5", "3/4" or "-7/2" to an exact fraction. */
export function parseNumber(raw: string): { value: Frac; isDecimal: boolean } | null {
  const input = raw.trim();
  let match = /^(-?\d+)\/(-?\d+)$/.exec(input);
  if (match) {
    const d = Number(match[2]);
    if (d === 0) return null;
    return { value: { n: Number(match[1]), d }, isDecimal: false };
  }
  match = /^(-?)(\d*)\.(\d{1,9})$/.exec(input);
  if (match) {
    const scale = 10 ** match[3].length;
    const sign = match[1] === '-' ? -1 : 1;
    return { value: { n: sign * (Number(match[2] || '0') * scale + Number(match[3])), d: scale }, isDecimal: true };
  }
  match = /^-?\d+$/.exec(input);
  if (match) return { value: { n: Number(input), d: 1 }, isDecimal: false };
  return null;
}

function same(a: Frac, b: Frac): boolean {
  return a.n * b.d === b.n * a.d;
}

const value = (f: Frac) => f.n / f.d;

/** Whether an answer is right, for the feedback flash. The site has the final word. */
export function isCorrect(problem: DailyProblem, answer: string): boolean {
  if (answer === SKIP) return false;
  switch (problem.kind) {
    case 'mental_maths':
      return answer.trim() !== '' && Number(answer) === problem.answer;
    case 'fast_fractions': {
      const typed = Number(answer);
      if (!Number.isFinite(typed) || answer.trim() === '') return false;
      const exact = problem.numerator / problem.denominator;
      return Math.round(typed * 1000) === Math.round(exact * 1000);
    }
    case 'sprint':
      return answer === problem.options[problem.answer];
    case 'sequence': {
      const parsed = parseNumber(answer);
      if (!parsed) return false;
      const target = { n: problem.answer.n, d: problem.answer.d };
      if (same(parsed.value, target)) return true;
      // A non-whole answer typed as a rounded decimal, as the site allows.
      const whole = target.n % target.d === 0;
      if (parsed.isDecimal && !whole) {
        return Math.abs(value(parsed.value) - value(target)) < 5e-4 * Math.abs(value(target));
      }
      return false;
    }
  }
}

/** The right answer, written out for the review after a run. */
export function answerText(problem: DailyProblem): string {
  switch (problem.kind) {
    case 'mental_maths':
      return String(problem.answer);
    case 'fast_fractions':
      return problem.answer;
    case 'sprint':
      return problem.options[problem.answer] ?? '';
    case 'sequence': {
      const g = gcd(problem.answer.n, problem.answer.d);
      const n = problem.answer.n / g;
      const d = problem.answer.d / g;
      const sign = n * d < 0 ? '-' : '';
      return Math.abs(d) === 1 ? `${n / d}` : `${sign}${Math.abs(n)}/${Math.abs(d)}`;
    }
  }
}

/**
 * Collects the answer events the site verifies: one per question in order, timed from the
 * start of the run, never closer together than the site allows.
 */
export function createRecorder(startedAt: number) {
  const events: AnswerEvent[] = [];
  return {
    record(answer: string, at = Date.now()): AnswerEvent {
      const last = events.at(-1)?.t ?? -MIN_GAP_MS;
      const t = Math.max(Math.round(at - startedAt), last + MIN_GAP_MS);
      const event = { i: events.length, a: answer, t };
      events.push(event);
      return event;
    },
    get events() {
      return events.slice();
    },
  };
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
