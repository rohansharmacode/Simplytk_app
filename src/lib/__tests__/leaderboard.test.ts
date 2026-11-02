import { leagueLine, ordinal, pinnedRow, timeLeft, zoneLabel } from '../leaderboard';

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
