import type { CourseDrill } from '@/lib/site-api';

/** The tutor's bands, as /interview-course names them: 0 is no attempt, 5 interview-ready. */
export const BAND_LABELS = [
  'No attempt',
  'Off track',
  'Some relevant ideas',
  'Partial answer',
  'Nearly there',
  'Interview-ready',
] as const;

export function bandLabel(band: number): string {
  return BAND_LABELS[Math.max(0, Math.min(BAND_LABELS.length - 1, Math.round(band)))];
}

export type BandTone = 'green' | 'blue' | 'amber' | 'red';

export function bandTone(band: number): BandTone {
  if (band >= 5) return 'green';
  if (band >= 3) return 'blue';
  if (band >= 2) return 'amber';
  return 'red';
}

export const DIFFICULTY_LABELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard' } as const;

/** Where a module's drill opens on the site: practice drills carry their topic. */
export function coursePathFor(drill: CourseDrill): string {
  return drill.practiceTopic ? `${drill.to}?topic=${encodeURIComponent(drill.practiceTopic)}` : drill.to;
}

/** The caller's best band per question. */
export function bandsByQuestion(progress: { questionId: string; band: number }[]): Map<string, number> {
  const bands = new Map<string, number>();
  for (const row of progress) bands.set(row.questionId, Math.max(row.band, bands.get(row.questionId) ?? 0));
  return bands;
}

/** How many of a module's questions are answered, and how many reached interview-ready. */
export function moduleProgress(questionIds: string[], bands: Map<string, number>) {
  let answered = 0;
  let ready = 0;
  for (const id of questionIds) {
    const band = bands.get(id);
    if (band == null) continue;
    answered += 1;
    if (band >= 5) ready += 1;
  }
  return { answered, ready, total: questionIds.length };
}

/** The tutor needs a real attempt: a few characters at least, as on the site. */
export function canAsk(answer: string): boolean {
  return answer.trim().length >= 3;
}
