/**
 * The website's application stages (src/lib/application-stage.ts there). The database
 * keeps a status plus a stage_completed_at stamp, so "Online test done" is the status
 * online_test with the stamp set. Kept in step with the site so a change in the app shows
 * the same on simplytk.com.
 */
import type { Tone } from '@/constants/theme';

export type ApplicationStatus = 'not_started' | 'applied' | 'online_test' | 'interview' | 'offer' | 'rejected';
export type ApplicationStage = ApplicationStatus | 'online_test_done' | 'interview_done';

export const STAGES: readonly ApplicationStage[] = [
  'not_started',
  'applied',
  'online_test',
  'online_test_done',
  'interview',
  'interview_done',
  'offer',
  'rejected',
];

export const STAGE_LABELS: Record<ApplicationStage, string> = {
  not_started: 'Not started',
  applied: 'Applied',
  online_test: 'Online test',
  online_test_done: 'Online test done',
  interview: 'Interview',
  interview_done: 'Interview done',
  offer: 'Offer',
  rejected: 'Rejected',
};

export const STAGE_TONES: Record<ApplicationStage, Tone> = {
  not_started: 'blue',
  applied: 'blue',
  online_test: 'amber',
  online_test_done: 'amber',
  interview: 'amber',
  interview_done: 'amber',
  offer: 'green',
  rejected: 'red',
};

const DONE_STAGE: Partial<Record<string, ApplicationStage>> = {
  online_test: 'online_test_done',
  interview: 'interview_done',
};

export function isStage(value: unknown): value is ApplicationStage {
  return typeof value === 'string' && (STAGES as readonly string[]).includes(value);
}

/** The stage a row is at, from its status and completed stamp. */
export function stageOf(row: { status?: string | null; stage_completed_at?: string | null }): ApplicationStage {
  const status = row.status ?? 'not_started';
  if (row.stage_completed_at) {
    const done = DONE_STAGE[status];
    if (done) return done;
  }
  return isStage(status) ? status : 'not_started';
}

/** The columns to write for a stage. */
export function stageToStatus(stage: ApplicationStage): { status: ApplicationStatus; completed: boolean } {
  if (stage === 'online_test_done') return { status: 'online_test', completed: true };
  if (stage === 'interview_done') return { status: 'interview', completed: true };
  return { status: stage, completed: false };
}

/** The sections of My applications, in the order they show. */
export const SECTIONS = [
  { key: 'to_apply', title: 'To apply', stages: ['not_started'] },
  { key: 'applied', title: 'Applied', stages: ['applied'] },
  { key: 'in_progress', title: 'Tests and interviews', stages: ['online_test', 'online_test_done', 'interview', 'interview_done'] },
  { key: 'offer', title: 'Offers', stages: ['offer'] },
  { key: 'rejected', title: 'Rejected', stages: ['rejected'] },
] as const satisfies readonly { key: string; title: string; stages: readonly ApplicationStage[] }[];

export type SectionKey = (typeof SECTIONS)[number]['key'];

/** Rows grouped into the sections, keeping each section's rows in the order given. */
export function groupByStage<T extends { status?: string | null; stage_completed_at?: string | null }>(
  rows: readonly T[],
): { key: SectionKey; title: string; rows: T[] }[] {
  return SECTIONS.map((section) => ({
    key: section.key,
    title: section.title,
    rows: rows.filter((row) => (section.stages as readonly ApplicationStage[]).includes(stageOf(row))),
  })).filter((section) => section.rows.length > 0);
}

/** The student's local calendar day as YYYY-MM-DD, for the applied date (as on the site). */
export function localDay(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Counts for the progress screen: how far the student's applications have got. */
export function funnel(rows: readonly { status?: string | null; stage_completed_at?: string | null; kind?: string | null }[]) {
  const internships = rows.filter((row) => row.kind !== 'event');
  const at = (stages: ApplicationStage[]) => internships.filter((row) => stages.includes(stageOf(row))).length;
  return {
    tracked: internships.length,
    applied: internships.length - at(['not_started']),
    interviews: at(['interview', 'interview_done', 'offer']),
    offers: at(['offer']),
  };
}
