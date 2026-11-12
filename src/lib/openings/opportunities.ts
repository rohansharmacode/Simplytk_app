/**
 * Startup opportunities: accelerators, fellowships, hackathons and events, from the
 * website's `opportunities` table (src/lib/opportunities.ts on the site).
 */

export type OpportunityKind = 'fellowship' | 'vc' | 'accelerator' | 'incubator' | 'hackathon' | 'event';

export type Opportunity = {
  id: string;
  name: string;
  organiser: string;
  kind: OpportunityKind;
  description: string | null;
  url: string;
  location: string | null;
  event_date: string | null;
  deadline: string | null;
  created_at: string;
};

export const KIND_LABELS: Record<OpportunityKind, string> = {
  fellowship: 'Fellowship',
  vc: 'VC programme',
  accelerator: 'Accelerator',
  incubator: 'Incubator',
  hackathon: 'Hackathon',
  event: 'Event',
};

export const KINDS = Object.keys(KIND_LABELS) as OpportunityKind[];

export function kindLabel(kind: string): string {
  return KIND_LABELS[kind as OpportunityKind] ?? kind;
}

/** Past both its deadline and its date. One with neither is rolling and never stale. */
export function isStale(row: Pick<Opportunity, 'deadline' | 'event_date'>, now: Date): boolean {
  if (!row.deadline && !row.event_date) return false;
  const latest = Math.max(
    row.deadline ? new Date(row.deadline).getTime() : 0,
    row.event_date ? new Date(row.event_date).getTime() : 0,
  );
  return latest < now.getTime();
}

/** Where a rolling programme sits against dated ones: as if a week away. */
export const ROLLING_RANK_DAYS = 7;

const DAY_MS = 86_400_000;

function daysUntilNext(row: Pick<Opportunity, 'deadline' | 'event_date'>, now: Date): number | null {
  const upcoming = [row.deadline, row.event_date]
    .map((value) => (value ? new Date(value).getTime() : Number.NaN))
    .filter((time) => Number.isFinite(time) && time >= now.getTime());
  if (upcoming.length === 0) return null;
  return (Math.min(...upcoming) - now.getTime()) / DAY_MS;
}

/** The site's order: soonest first, rolling ones a week out, then by kind, then newest. */
export function sortOpportunities<T extends Pick<Opportunity, 'kind' | 'deadline' | 'event_date' | 'created_at' | 'name'>>(
  rows: readonly T[],
  now: Date,
): T[] {
  const ranked = rows.map((row) => {
    const days = daysUntilNext(row, now);
    const kind = KINDS.indexOf(row.kind);
    return {
      row,
      rolling: days === null,
      rank: days ?? ROLLING_RANK_DAYS,
      kind: kind === -1 ? KINDS.length : kind,
      created: new Date(row.created_at).getTime(),
    };
  });
  ranked.sort(
    (a, b) =>
      a.rank - b.rank ||
      Number(a.rolling) - Number(b.rolling) ||
      (a.rolling ? a.kind - b.kind : 0) ||
      b.created - a.created ||
      a.row.name.localeCompare(b.row.name),
  );
  return ranked.map((entry) => entry.row);
}

/** The line under a name: "Deadline 9 Aug · Online". */
export function opportunityMeta(row: Pick<Opportunity, 'deadline' | 'event_date' | 'location'>): string {
  const format = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' });
  const parts = [
    row.deadline ? `Deadline ${format(row.deadline)}` : row.event_date ? `On ${format(row.event_date)}` : 'Rolling',
    row.location ?? '',
  ].filter(Boolean);
  return parts.join(' · ');
}
