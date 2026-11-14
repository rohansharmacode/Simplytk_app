import { leagueLine, ordinal, pinnedRow, playerBoard, timeLeft, universityBoard, zoneLabel } from '../leaderboard';
import { withZone } from '../site-api';

jest.mock('../session', () => ({ getSession: () => null }));
jest.mock('../supabase', () => ({ supabase: { auth: { getSession: () => Promise.resolve({ data: { session: null } }) } } }));

const entry = (rank: number, isYou = false) => ({ rank, username: `p${rank}`, isYou, university: null, score: 100 - rank });

describe('pinnedRow', () => {
  it('pins your row when it is below the board', () => {
    const you = entry(140, true);
    expect(pinnedRow({ entries: [entry(1), entry(2)], you })).toBe(you);
  });

  it('pins your row from the board when the board has it', () => {
    const board = { entries: [entry(1), entry(2, true)], you: null };
    expect(pinnedRow(board)).toBe(board.entries[1]);
  });

  it('pins nothing before you have played', () => {
    expect(pinnedRow({ entries: [entry(1)], you: null })).toBeNull();
  });
});

describe('league', () => {
  it('says where you are', () => {
    const members = Array.from({ length: 30 }, (_, i) => ({ rank: i + 1 }));
    expect(leagueLine({ tier: 'silver', members, you: { rank: 4, points: 120, zone: 'promote' } } as never)).toBe(
      '4th of 30 in Silver',
    );
    expect(zoneLabel('promote', 'gold')).toBe('Promotion zone');
    expect(zoneLabel('promote', 'diamond')).toBe('Top of Diamond');
    expect(zoneLabel('demote', 'gold')).toBe('Relegation zone');
    expect(zoneLabel('stay', 'gold')).toBe('Safe');
  });

  it('counts down to the Monday reset', () => {
    const now = new Date('2026-11-05T10:00:00Z');
    expect(timeLeft('2026-11-09T00:00:00Z', now)).toBe('3d 14h left');
    expect(timeLeft('2026-11-05T12:30:00Z', now)).toBe('2h 30m left');
    expect(timeLeft('2026-11-05T10:20:00Z', now)).toBe('20m left');
    expect(timeLeft('2026-11-05T09:00:00Z', now)).toBe('Resetting');
  });

  it('writes ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101, 111].map(ordinal)).toEqual([
      '1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '101st', '111th',
    ]);
  });
});

describe('the site boards', () => {
  const siteEntry = (rank: number, isYou = false) => ({
    rank,
    username: `p${rank}`,
    isYou,
    university: null,
    linkedin: null,
    score: 20 - rank,
    durationMs: 60_000,
  });
  const board = { day: '2026-11-05', number: 213, players: 812, percentile: 83 };

  it('pins your rank below the top 100 without a score', () => {
    const result = playerBoard({ ...board, entries: [siteEntry(1)], yourRank: 140 });
    expect(result.you).toEqual({
      rank: 140,
      username: null,
      isYou: true,
      university: null,
      score: null,
      detail: 'Ahead of 83% of players',
    });
    expect(result.players).toBe(812);
  });

  it('pins your row from the board when you are in it', () => {
    const result = playerBoard({ ...board, entries: [siteEntry(1), siteEntry(2, true)], yourRank: 2 });
    expect(result.you).toMatchObject({ rank: 2, username: 'p2', score: 18, durationMs: 60_000 });
  });

  it('pins nothing before you have played', () => {
    expect(playerBoard({ ...board, entries: [siteEntry(1)], yourRank: null, percentile: null }).you).toBeNull();
  });

  it('draws universities with their points and players', () => {
    const result = universityBoard({
      entries: [
        { rank: 1, university: 'LSE', points: 96, members: 41, isYours: false },
        { rank: 2, university: 'UCL', points: 90, members: 1, isYours: true },
      ],
      yourUniversity: 'UCL',
    });
    expect(result.entries[0]).toMatchObject({ username: 'LSE', score: 96, detail: '41 players' });
    expect(result.you).toMatchObject({ rank: 2, username: 'UCL', detail: '1 player' });
  });
});

describe('withZone', () => {
  it("adds the phone's zone to the query", () => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    expect(withZone('/api/app/leaderboard', { period: 'month' })).toBe(
      `/api/app/leaderboard?period=month&tz=${encodeURIComponent(zone)}`,
    );
    expect(withZone('/api/app/streak')).toBe(`/api/app/streak?tz=${encodeURIComponent(zone)}`);
  });
});
