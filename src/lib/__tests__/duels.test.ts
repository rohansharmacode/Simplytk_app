import { duelCodeFrom, duelDeadline, duelHeadline, duelShareText, duelStatusLabel, yourMove } from '@/lib/duels';
import type { Duel } from '@/lib/site-api';

const side = (patch = {}) => ({ username: 'rohan', isYou: true, score: null, scoreText: null, playedAt: null, ...patch });

const duel = (patch: Partial<Duel> = {}): Duel => ({
  code: 'abc123',
  game: 'mental_maths',
  label: 'Mental Maths',
  path: '/mental-maths',
  lowerIsBetter: false,
  createdAt: '2026-11-12T00:00:00Z',
  acceptedAt: null,
  cancelledAt: null,
  expiresAt: '2026-11-19T00:00:00Z',
  status: 'open',
  result: null,
  walkover: false,
  challenger: side(),
  opponent: null,
  yourRole: 'challenger',
  link: 'https://simplytk.com/1v1/abc123',
  ...patch,
});

describe('duel wording', () => {
  it('reads from your side, as the website does', () => {
    expect(duelHeadline(duel())).toBe('Waiting for someone to accept your challenge.');
    expect(duelHeadline(duel({ yourRole: 'opponent' }))).toBe('rohan has challenged you to a 1v1.');
    const live = duel({ status: 'live', acceptedAt: 'x', opponent: side({ username: 'sam', isYou: false }) });
    expect(duelHeadline(live)).toBe('Your move. Play one ranked run of this game and it counts.');
    expect(yourMove(live)).toBe(true);
    const played = { ...live, challenger: side({ score: 40 }) };
    expect(duelHeadline(played)).toBe('Your run is in. Waiting on your opponent.');
    expect(yourMove(played)).toBe(false);
    expect(duelHeadline(duel({ status: 'settled', result: 'challenger', walkover: true }))).toBe(
      'You won by walkover: the other side never played.',
    );
    expect(duelStatusLabel(duel({ status: 'settled', result: 'opponent' }))).toBe('You lost');
  });

  it('builds the share message', () => {
    expect(duelShareText('Mental Maths', '42', 'L')).toBe('I scored 42 on Mental Maths on simplytk. Think you can beat me? 1v1 me: L');
    expect(duelShareText('Mental Maths', null, 'L')).toBe('1v1 me on Mental Maths on simplytk. One run each, best score wins: L');
  });

  it('reads a code from a link or on its own', () => {
    expect(duelCodeFrom('https://simplytk.com/1v1/AbC123x')).toBe('abc123x');
    expect(duelCodeFrom(' abc123 ')).toBe('abc123');
    expect(duelCodeFrom('no!')).toBeNull();
  });

  it('counts down to the deadline', () => {
    const now = new Date('2026-11-12T00:00:00Z');
    expect(duelDeadline('2026-11-15T01:00:00Z', now)).toBe('Ends in 3 days');
    expect(duelDeadline('2026-11-12T05:00:00Z', now)).toBe('Ends in 5 hours');
    expect(duelDeadline('2026-11-11T00:00:00Z', now)).toBe('Ended');
  });
});
