import type { Duel } from '@/lib/site-api';
import type { Tone } from '@/constants/theme';

/**
 * 1v1 wording, the same as the website's /1v1 pages (src/lib/oa-duels.ts there).
 * A duel is one game, two players, one ranked run each; each side's score is its first
 * ranked run of the game after its side opened.
 */

/** Days from creation until a duel is decided. */
export const DUEL_WINDOW_DAYS = 7;

/** The short label on a duel in a list. */
export function duelStatusLabel(duel: Pick<Duel, 'status' | 'result' | 'yourRole'>): string {
  switch (duel.status) {
    case 'open':
      return 'Waiting for an opponent';
    case 'live':
      return 'In play';
    case 'void':
      return 'Void';
    case 'cancelled':
      return 'Cancelled';
    case 'settled':
      if (duel.result === 'draw') return 'Draw';
      if (duel.yourRole === 'spectator') return 'Settled';
      return duel.result === duel.yourRole ? 'You won' : 'You lost';
  }
}

export function duelStatusTone(duel: Pick<Duel, 'status' | 'result' | 'yourRole'>): Tone {
  if (duel.status === 'settled') {
    if (duel.result === 'draw' || duel.yourRole === 'spectator') return 'blue';
    return duel.result === duel.yourRole ? 'green' : 'red';
  }
  if (duel.status === 'live') return 'amber';
  if (duel.status === 'open') return 'blue';
  return 'red';
}

/** Your own side of a duel, or null for a spectator. */
export function yourSide(duel: Pick<Duel, 'yourRole' | 'challenger' | 'opponent'>) {
  if (duel.yourRole === 'challenger') return duel.challenger;
  if (duel.yourRole === 'opponent') return duel.opponent;
  return null;
}

/** Whether it's the caller's turn to play their ranked run. */
export function yourMove(duel: Duel): boolean {
  return duel.status === 'live' && duel.yourRole !== 'spectator' && yourSide(duel)?.score == null;
}

/** The one-line verdict the duel screen leads with, from your side. */
export function duelHeadline(duel: Duel): string {
  const challenger = duel.challenger.username ?? 'The challenger';
  const opponent = duel.opponent?.username ?? 'the opponent';
  switch (duel.status) {
    case 'open':
      return duel.yourRole === 'challenger'
        ? 'Waiting for someone to accept your challenge.'
        : `${challenger} has challenged you to a 1v1.`;
    case 'live':
      if (duel.yourRole === 'spectator') return `${challenger} against ${opponent}: runs pending.`;
      return yourSide(duel)?.score == null
        ? 'Your move. Play one ranked run of this game and it counts.'
        : 'Your run is in. Waiting on your opponent.';
    case 'void':
      return duel.acceptedAt
        ? 'Nobody played before the deadline, so this one is void.'
        : 'Nobody accepted before the deadline, so this one is void.';
    case 'cancelled':
      return duel.yourRole === 'challenger'
        ? 'You cancelled this challenge.'
        : `${challenger} withdrew this challenge before anyone accepted it.`;
    case 'settled': {
      if (duel.result === 'draw') return 'A draw. Same score, same game.';
      const winner = duel.result === 'challenger' ? 'challenger' : 'opponent';
      const suffix = duel.walkover ? ' by walkover: the other side never played.' : '.';
      if (duel.yourRole === 'spectator') return `${winner === 'challenger' ? challenger : opponent} won${suffix}`;
      return duel.yourRole === winner ? `You won${suffix}` : `You lost${suffix}`;
    }
  }
}

/** The message shared with the link, with the challenger's score when they have one. */
export function duelShareText(label: string, score: string | null, link: string): string {
  return score
    ? `I scored ${score} on ${label} on simplytk. Think you can beat me? 1v1 me: ${link}`
    : `1v1 me on ${label} on simplytk. One run each, best score wins: ${link}`;
}

/** A duel code from a pasted link or the code itself, or null. */
export function duelCodeFrom(input: string): string | null {
  const trimmed = input.trim();
  const fromLink = /\/1v1\/([a-z0-9]+)/i.exec(trimmed)?.[1];
  const code = (fromLink ?? trimmed).toLowerCase();
  return /^[a-z0-9]{6,12}$/.test(code) ? code : null;
}

/** "Ends in 3 days" or "Ended". */
export function duelDeadline(expiresAt: string, now: Date): string {
  const ms = new Date(expiresAt).getTime() - now.getTime();
  if (ms <= 0) return 'Ended';
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 24) return hours <= 1 ? 'Ends within the hour' : `Ends in ${hours} hours`;
  const days = Math.floor(hours / 24);
  return `Ends in ${days} day${days === 1 ? '' : 's'}`;
}
