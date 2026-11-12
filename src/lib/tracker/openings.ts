/**
 * The tracker's pure logic: the filters the app offers, what a deadline says, and the
 * order openings are shown in. The queries that use it are in ./queries.ts.
 */

/** The markets simplytk.com tracks (scraper/region.ts on the website). */
export const REGIONS = ['uk', 'us', 'in', 'ch', 'gcc', 'au', 'de', 'nl', 'sg', 'hk'] as const;
export type Region = (typeof REGIONS)[number];

export const REGION_LABELS: Record<Region, string> = {
  uk: 'UK',
  us: 'US',
  in: 'India',
  ch: 'Switzerland',
  gcc: 'Gulf',
  au: 'Australia',
  de: 'Germany',
  nl: 'Netherlands',
  sg: 'Singapore',
  hk: 'Hong Kong',
};

export function isRegion(value: unknown): value is Region {
  return typeof value === 'string' && (REGIONS as readonly string[]).includes(value);
}

/** The opening types students filter by. The website's `programme_type` values. */
export const TYPES = ['spring_week', 'summer_internship', 'graduate', 'off_cycle', 'industrial_placement'] as const;
export type OpeningType = (typeof TYPES)[number];

export const TYPE_LABELS: Record<string, string> = {
  spring_week: 'Spring week',
  summer_internship: 'Summer internship',
  graduate: 'Graduate',
  off_cycle: 'Off-cycle',
  industrial_placement: 'Placement',
  vacation_scheme: 'Vacation scheme',
  work_experience: 'Work experience',
  insight_scheme: 'Insight scheme',
  apprenticeship: 'Apprenticeship',
  summer_school: 'Summer school',
  access_programme: 'Access programme',
  thesis: 'Thesis',
};

export function typeLabel(type: string | null | undefined): string {
  if (!type) return '';
  return TYPE_LABELS[type] ?? type.replace(/_/g, ' ');
}

/** School-age programmes: the website's separate pre-university tracker. */
export const PRE_UNI_TYPES = ['work_experience', 'summer_school', 'access_programme', 'apprenticeship'] as const;
export type PreUniType = (typeof PRE_UNI_TYPES)[number];

/** University openings, or the pre-university tracker's school-age ones. */
export type Stage = 'uni' | 'preuni';

export const STAGE_LABELS: Record<Stage, string> = { uni: 'University', preuni: 'Pre-uni' };

/** The type chips each stage offers. */
export function typesFor(stage: Stage): readonly (OpeningType | PreUniType)[] {
  return stage === 'preuni' ? PRE_UNI_TYPES : TYPES;
}

export const DEADLINE_FILTERS = ['any', 'week', 'month'] as const;
export type DeadlineFilter = (typeof DEADLINE_FILTERS)[number];

export const DEADLINE_LABELS: Record<DeadlineFilter, string> = {
  any: 'Any deadline',
  week: 'Closing this week',
  month: 'Closing this month',
};

export type Filters = {
  /** University or pre-university openings. A view, not counted as a filter. */
  stage?: Stage;
  region: Region;
  types: (OpeningType | PreUniType)[];
  /** Firm name search; empty for every firm. */
  firm: string;
  deadline: DeadlineFilter;
};

export const DEFAULT_FILTERS: Filters = { region: 'uk', types: [], firm: '', deadline: 'any' };

export function activeFilterCount(filters: Filters): number {
  return (
    (filters.region === DEFAULT_FILTERS.region ? 0 : 1) +
    filters.types.length +
    (filters.firm.trim() ? 1 : 0) +
    (filters.deadline === 'any' ? 0 : 1)
  );
}

/** The latest deadline a filter allows, or null for no limit. */
export function deadlineCutoff(filter: DeadlineFilter, now: Date): Date | null {
  if (filter === 'any') return null;
  const days = filter === 'week' ? 7 : 31;
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Words for a firm search, safe to put in a PostgREST `ilike` filter. */
export function firmSearchTerm(input: string): string | null {
  const cleaned = input.replace(/[%,()*\\]/g, ' ').trim().replace(/\s+/g, ' ');
  return cleaned ? cleaned.slice(0, 60) : null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whole days left, counting the deadline's own day as 0, in London time like the site's
 * reminder emails. Negative once it has passed.
 */
export function daysLeft(deadlineIso: string, now: Date): number {
  const day = (date: Date) => {
    const [y, m, d] = date
      .toLocaleDateString('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' })
      .split('/')
      .reverse()
      .map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((day(new Date(deadlineIso)) - day(now)) / DAY_MS);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' });
}

export type DeadlineTone = 'urgent' | 'soon' | 'normal' | 'none';

/** What the card says about a deadline, and how loudly. */
export function deadlineLabel(deadlineIso: string | null | undefined, now: Date): { text: string; tone: DeadlineTone } {
  if (!deadlineIso) return { text: 'Rolling', tone: 'none' };
  const left = daysLeft(deadlineIso, now);
  if (left < 0) return { text: `Closed ${formatDate(deadlineIso)}`, tone: 'none' };
  if (left === 0) return { text: 'Closes today', tone: 'urgent' };
  if (left === 1) return { text: 'Closes tomorrow', tone: 'urgent' };
  if (left <= 7) return { text: `${left} days left`, tone: 'soon' };
  return { text: `Closes ${formatDate(deadlineIso)}`, tone: 'normal' };
}

/** Nearest deadline first; rolling openings (no deadline) after every dated one. */
export function byDeadline<T extends { deadline?: string | null }>(a: T, b: T): number {
  if (!a.deadline && !b.deadline) return 0;
  if (!a.deadline) return 1;
  if (!b.deadline) return -1;
  return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
}

/** Starred openings for Home: still open, nearest deadline first. */
export function upcomingStarred<T extends { deadline?: string | null; status?: string | null }>(
  openings: T[],
  now: Date,
): T[] {
  return openings
    .filter((o) => (o.status ?? 'open') === 'open' && (!o.deadline || daysLeft(o.deadline, now) >= 0))
    .sort(byDeadline);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isOpeningId(value: string): boolean {
  return UUID.test(value);
}

/** simplytk.com/openings/<firm>-<role>-<id>: the id is the last 36 characters. */
export function openingIdFromSlug(slug: string): string | null {
  const id = slug.slice(-36);
  return isOpeningId(id) ? id.toLowerCase() : null;
}
