/**
 * The live feed: every opening the moment the website's scrapers detect it, newest first
 * (src/routes/live.tsx on the site).
 */

/** "Today", "Yesterday" or "Monday 9 November", in the phone's own time. */
export function dayLabel(iso: string, now: Date): string {
  const date = new Date(iso);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(date, now)) return 'Today';
  if (sameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** Rows grouped by the day they were detected, keeping their order. */
export function groupByDay<T extends { first_seen_at: string | null }>(rows: readonly T[], now: Date) {
  const groups: { label: string; rows: T[] }[] = [];
  for (const row of rows) {
    if (!row.first_seen_at) continue;
    const label = dayLabel(row.first_seen_at, now);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.rows.push(row);
    else groups.push({ label, rows: [row] });
  }
  return groups;
}

/** "14:05", when it was detected. */
export function detectedAt(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/** Detected in the last day, as the site marks it. */
export function isNew(iso: string, now: Date): boolean {
  const age = now.getTime() - new Date(iso).getTime();
  return age >= 0 && age < 86_400_000;
}
