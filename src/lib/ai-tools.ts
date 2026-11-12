import type { AiQuota, AiTier, MockRound } from '@/lib/site-api';

/** CVs over this size are refused by the site, so the app refuses them first. */
export const CV_MAX_BYTES = 5 * 1024 * 1024;

/** File types the CV rater and the cover letter tool read. */
export const CV_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

export function isCvFile(name: string): boolean {
  return /\.(pdf|docx|txt)$/i.test(name.trim());
}

export type ScoreTone = 'green' | 'amber' | 'red';

/** A mark out of `outOf` as a colour: green from 80%, amber from 50%. */
export function scoreTone(score: number, outOf = 10): ScoreTone {
  const share = outOf > 0 ? score / outOf : 0;
  if (share >= 0.8) return 'green';
  if (share >= 0.5) return 'amber';
  return 'red';
}

/** What's left of today's allowance, in one line. */
export function quotaLine(quota: AiQuota | null | undefined, noun: string): string | null {
  if (!quota) return null;
  if (quota.pass) return `Your pass covers every ${noun} at full depth.`;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  if (quota.freeLeft > 0) {
    return `${plural(quota.freeLeft, `full-depth ${noun}`)} left today, then ${plural(quota.quickPerDay, 'quick one')}.`;
  }
  const quick = Math.max(0, quota.quickLeft);
  if (quick > 0) return `Today's full-depth ${noun} is used. ${plural(quick, `quick ${noun}`)} left.`;
  if (quota.credits > 0) return `${plural(quota.credits, `saved ${noun}`)} left.`;
  return `Today's ${noun}s are used. They come back tomorrow.`;
}

/** A line for a run that went to the faster model. */
export function tierNote(tier: AiTier | undefined): string | null {
  return tier === 'quick' ? 'Quick run: today’s full-depth one was used, so this used the faster model.' : null;
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** 95 seconds as "1:35". */
export function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** The mock interview's mark: the mean of the rounds that were scored, one decimal. */
export function averageScore(rounds: Pick<MockRound, 'score'>[]): number | null {
  const scored = rounds.map((r) => r.score).filter((s): s is number => s != null);
  if (!scored.length) return null;
  return Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 10) / 10;
}

/** The site wants 40 characters before it marks an interview answer. */
export const MIN_ANSWER_CHARS = 40;

export function canScore(answer: string): boolean {
  return answer.trim().length >= MIN_ANSWER_CHARS;
}

/** Seconds a mock interview gives each answer. */
export const MOCK_ANSWER_SECONDS = 120;

/** Characters of the 4,000 the UCAS form allows, across the three answers. */
export function statementLength(answers: string[]): number {
  return answers.reduce((sum, answer) => sum + answer.length, 0);
}

/** "3,412 of 4,000 characters", flagged when over. */
export function statementCount(answers: string[], limit: number): { text: string; over: boolean } {
  const used = statementLength(answers);
  return { text: `${used.toLocaleString('en-GB')} of ${limit.toLocaleString('en-GB')} characters`, over: used > limit };
}
