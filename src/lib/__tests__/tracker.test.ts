import {
  activeFilterCount,
  byDeadline,
  daysLeft,
  deadlineCutoff,
  deadlineLabel,
  DEFAULT_FILTERS,
  firmSearchTerm,
  openingIdFromSlug,
  typeLabel,
  upcomingStarred,
} from '../tracker/openings';

// 10:00 in London on Monday 2 November 2026 (GMT, so the same in UTC).
const NOW = new Date('2026-11-02T10:00:00Z');

describe('deadlines', () => {
  it('counts whole London days, the deadline day being day 0', () => {
    expect(daysLeft('2026-11-02T23:59:00Z', NOW)).toBe(0);
    expect(daysLeft('2026-11-03T00:30:00Z', NOW)).toBe(1);
    expect(daysLeft('2026-11-09T12:00:00Z', NOW)).toBe(7);
    expect(daysLeft('2026-11-01T12:00:00Z', NOW)).toBe(-1);
  });

  it('counts by London time across the clocks changing', () => {
    // 23:30 UTC on 1 July is 00:30 BST on 2 July.
    expect(daysLeft('2026-07-01T23:30:00Z', new Date('2026-07-01T10:00:00Z'))).toBe(1);
  });

  it('says how urgent a deadline is', () => {
    expect(deadlineLabel('2026-11-02T18:00:00Z', NOW)).toEqual({ text: 'Closes today', tone: 'urgent' });
    expect(deadlineLabel('2026-11-03T18:00:00Z', NOW)).toEqual({ text: 'Closes tomorrow', tone: 'urgent' });
    expect(deadlineLabel('2026-11-06T18:00:00Z', NOW)).toEqual({ text: '4 days left', tone: 'soon' });
    expect(deadlineLabel('2026-11-30T18:00:00Z', NOW)).toEqual({ text: 'Closes 30 Nov', tone: 'normal' });
    expect(deadlineLabel(null, NOW)).toEqual({ text: 'Rolling', tone: 'none' });
    expect(deadlineLabel('2026-10-30T18:00:00Z', NOW).text).toBe('Closed 30 Oct');
  });

  it('limits deadlines to a week or a month ahead', () => {
    expect(deadlineCutoff('any', NOW)).toBeNull();
    expect(deadlineCutoff('week', NOW)?.toISOString()).toBe('2026-11-09T10:00:00.000Z');
    expect(deadlineCutoff('month', NOW)?.toISOString()).toBe('2026-12-03T10:00:00.000Z');
  });
});

describe('ordering', () => {
  it('puts the nearest deadline first and rolling openings last', () => {
    const rows = [{ deadline: null }, { deadline: '2026-12-01T00:00:00Z' }, { deadline: '2026-11-05T00:00:00Z' }];
    expect(rows.sort(byDeadline).map((r) => r.deadline)).toEqual([
      '2026-11-05T00:00:00Z',
      '2026-12-01T00:00:00Z',
      null,
    ]);
  });

  it('leaves closed and past openings off Home', () => {
    const rows = [
      { id: 'past', deadline: '2026-11-01T00:00:00Z', status: 'open' },
      { id: 'closed', deadline: '2026-11-20T00:00:00Z', status: 'closed' },
      { id: 'later', deadline: '2026-11-20T00:00:00Z', status: 'open' },
      { id: 'today', deadline: '2026-11-02T20:00:00Z', status: 'open' },
      { id: 'rolling', deadline: null, status: 'open' },
    ];
    expect(upcomingStarred(rows, NOW).map((r) => r.id)).toEqual(['today', 'later', 'rolling']);
  });
});

describe('filters', () => {
  it('counts the filters a student changed', () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
    expect(
      activeFilterCount({ region: 'us', types: ['spring_week', 'graduate'], firm: ' gs ', deadline: 'week' }),
    ).toBe(5);
  });

  it('cleans firm searches for the database filter', () => {
    expect(firmSearchTerm('  Goldman   Sachs ')).toBe('Goldman Sachs');
    expect(firmSearchTerm('J.P. Morgan (UK), 100%')).toBe('J.P. Morgan UK 100');
    expect(firmSearchTerm('  ')).toBeNull();
  });

  it('labels opening types', () => {
    expect(typeLabel('spring_week')).toBe('Spring week');
    expect(typeLabel('something_new')).toBe('something new');
    expect(typeLabel(null)).toBe('');
  });
});

describe('openingIdFromSlug', () => {
  it('reads the id off the end of an opening page slug', () => {
    expect(openingIdFromSlug('citadel-quant-0F8A7C1E-2B3D-4E5F-8A9B-0C1D2E3F4A5B')).toBe(
      '0f8a7c1e-2b3d-4e5f-8a9b-0c1d2e3f4a5b',
    );
    expect(openingIdFromSlug('citadel-quant')).toBeNull();
  });
});
