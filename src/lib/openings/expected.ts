/**
 * "Opening soon": the website's predictions of when each firm's programme opens, from
 * when it opened in earlier cycles (src/lib/expected-openings*.ts on the site).
 */

export type ExpectedConfidence = 'high' | 'medium' | 'low';
export type ExpectedStatus = 'upcoming' | 'due' | 'overdue';

export type ExpectedRow = {
  id: string;
  company_name: string;
  programme_type: string;
  last_opened_at: string | null;
  last_cycle: number | null;
  evidence_source: string | null;
  expected_on: string;
  expected_from: string;
  expected_to: string;
  confidence: ExpectedConfidence;
};

export const PROGRAMME_LABELS: Record<string, string> = {
  spring_week: 'Spring week',
  summer_internship: 'Summer internship',
  off_cycle: 'Off-cycle internship',
  industrial_placement: 'Industrial placement',
  graduate: 'Graduate programme',
  work_experience: 'Work experience',
  apprenticeship: 'Apprenticeship',
  summer_school: 'Summer school',
  access_programme: 'Access programme',
};

export function programmeLabel(type: string): string {
  return PROGRAMME_LABELS[type] ?? type.replace(/_/g, ' ');
}

/** The site's wording (src/lib/expected-opening-copy.ts). */
export const STATUS_LABELS: Record<ExpectedStatus, string> = {
  due: 'Could open any day',
  upcoming: 'Coming up',
  overdue: 'Later than last year',
};

const CONFIDENCE_COPY: Record<ExpectedConfidence, string> = {
  high: 'We watched this one open last year',
  medium: 'Date taken from an aggregated feed',
  low: 'Only older evidence, treat as a rough guide',
};

/** What the guess is built on. */
export function evidenceCopy(row: Pick<ExpectedRow, 'confidence' | 'evidence_source'>): string {
  if (row.evidence_source === 'announced') return 'Date announced by the organiser';
  if (row.evidence_source === 'registry') return 'Based on the organiser’s usual application window';
  return CONFIDENCE_COPY[row.confidence] ?? CONFIDENCE_COPY.low;
}

/** The recruiting cycle in progress. It rolls over in June, as on the site. */
export function currentCycle(now: Date): number {
  return now.getUTCMonth() >= 5 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
}

function isoDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function expectedStatus(row: Pick<ExpectedRow, 'expected_from' | 'expected_to'>, now: Date): ExpectedStatus {
  const today = isoDay(now);
  if (today < row.expected_from) return 'upcoming';
  if (today > row.expected_to) return 'overdue';
  return 'due';
}

/** Whole days from today until the window opens. Negative once it has. */
export function daysUntil(row: Pick<ExpectedRow, 'expected_from'>, now: Date): number {
  const from = Date.parse(`${row.expected_from}T12:00:00.000Z`);
  const today = Date.parse(`${isoDay(now)}T12:00:00.000Z`);
  return Math.round((from - today) / 86_400_000);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "1 Sep" for a YYYY-MM-DD day. */
export function formatDay(iso: string): string {
  const date = new Date(`${iso.slice(0, 10)}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

/** "22 Aug to 11 Sep". */
export function formatWindow(row: Pick<ExpectedRow, 'expected_from' | 'expected_to'>): string {
  return `${formatDay(row.expected_from)} to ${formatDay(row.expected_to)}`;
}

/** When it opened last cycle: "1 Sep 2026". */
export function lastOpened(row: Pick<ExpectedRow, 'last_opened_at'>): string {
  const date = row.last_opened_at ? new Date(row.last_opened_at) : null;
  if (!date || Number.isNaN(date.getTime())) return 'an earlier cycle';
  return `${formatDay(row.last_opened_at!)} ${date.getUTCFullYear()}`;
}

/** Every typed word has to appear in the firm or the programme, in any order. */
export function matchesSearch(row: Pick<ExpectedRow, 'company_name' | 'programme_type'>, query: string): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = `${row.company_name} ${programmeLabel(row.programme_type)}`.toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

/** The predictions grouped the way the screen shows them: open now, then the next ones. */
export function groupExpected<T extends ExpectedRow>(rows: readonly T[], now: Date) {
  const due = rows.filter((row) => expectedStatus(row, now) === 'due');
  const upcoming = rows.filter((row) => expectedStatus(row, now) === 'upcoming');
  const late = rows.filter((row) => expectedStatus(row, now) === 'overdue');
  return [
    { key: 'due' as const, title: STATUS_LABELS.due, rows: due },
    { key: 'upcoming' as const, title: STATUS_LABELS.upcoming, rows: upcoming },
    { key: 'overdue' as const, title: STATUS_LABELS.overdue, rows: late },
  ].filter((group) => group.rows.length > 0);
}
