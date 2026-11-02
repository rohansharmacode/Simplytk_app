import type { Board, BoardEntry, League, LeagueTier, LeagueZone } from '@/lib/site-api';

/** The row pinned under a board: the student's own place, wherever it is. */
export function pinnedRow(board: Pick<Board, 'entries' | 'you'>): BoardEntry | null {
  return board.you ?? board.entries.find((entry) => entry.isYou) ?? null;
}

export const TIER_LABELS: Record<LeagueTier, string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
  diamond: 'Diamond',
};

export function zoneLabel(zone: LeagueZone, tier: LeagueTier): string {
  if (zone === 'promote') return tier === 'diamond' ? 'Top of Diamond' : 'Promotion zone';
  if (zone === 'demote') return 'Relegation zone';
  return 'Safe';
}

/** "3d 4h left" until the league resets on Monday, London time. */
export function timeLeft(endsAt: string, now: Date): string {
  const ms = new Date(endsAt).getTime() - now.getTime();
  if (ms <= 0) return 'Resetting';
  const hours = Math.floor(ms / 3_600_000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h left`;
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return hours > 0 ? `${hours}h ${minutes}m left` : `${minutes}m left`;
}

/** The line Home shows for the league: "4th of 30 in Silver". */
export function leagueLine(league: Pick<League, 'tier' | 'members' | 'you'>): string {
  return `${ordinal(league.you.rank)} of ${league.members.length} in ${TIER_LABELS[league.tier]}`;
}

export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}
