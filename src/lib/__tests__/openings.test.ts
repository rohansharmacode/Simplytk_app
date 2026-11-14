import {
  currentCycle,
  daysUntil,
  evidenceCopy,
  expectedStatus,
  formatWindow,
  groupExpected,
  lastOpened,
  matchesSearch,
  type ExpectedRow,
} from '@/lib/openings/expected';
import { dayLabel, groupByDay, isNew } from '@/lib/openings/live';
import { isStale, opportunityMeta, sortOpportunities } from '@/lib/openings/opportunities';

const row = (patch: Partial<ExpectedRow>): ExpectedRow => ({
  id: '1',
  company_name: 'Goldman Sachs',
  programme_type: 'spring_week',
  last_opened_at: '2025-09-01T09:00:00Z',
  last_cycle: 2026,
  evidence_source: 'first_party',
  expected_on: '2026-09-01',
  expected_from: '2026-08-22',
  expected_to: '2026-09-11',
  confidence: 'high',
  ...patch,
});

describe('expected openings', () => {
  const now = new Date('2026-08-25T10:00:00Z');

  it('rolls the cycle over in June', () => {
    expect(currentCycle(new Date('2026-05-31T12:00:00Z'))).toBe(2026);
    expect(currentCycle(new Date('2026-06-01T12:00:00Z'))).toBe(2027);
  });

  it('places a prediction against its window', () => {
    expect(expectedStatus(row({}), now)).toBe('due');
    expect(expectedStatus(row({ expected_from: '2026-09-01' }), now)).toBe('upcoming');
    expect(expectedStatus(row({ expected_to: '2026-08-24' }), now)).toBe('overdue');
    expect(daysUntil(row({ expected_from: '2026-09-01' }), now)).toBe(7);
  });

  it('words the window and the evidence like the site', () => {
    expect(formatWindow(row({}))).toBe('22 Aug to 11 Sep');
    expect(lastOpened(row({}))).toBe('1 Sep 2025');
    expect(lastOpened(row({ last_opened_at: null }))).toBe('an earlier cycle');
    expect(evidenceCopy(row({}))).toBe('We watched this one open last year');
    expect(evidenceCopy(row({ evidence_source: 'announced' }))).toBe('Date announced by the organiser');
  });

  it('matches every typed word in any order', () => {
    expect(matchesSearch(row({}), 'spring goldman')).toBe(true);
    expect(matchesSearch(row({}), 'gold summer')).toBe(false);
    expect(matchesSearch(row({}), '  ')).toBe(true);
  });

  it('groups due, then upcoming, then late', () => {
    const groups = groupExpected(
      [row({ id: 'u', expected_from: '2026-09-05' }), row({ id: 'd' }), row({ id: 'o', expected_to: '2026-08-01' })],
      now,
    );
    expect(groups.map((g) => [g.key, g.rows.map((r) => r.id)])).toEqual([
      ['due', ['d']],
      ['upcoming', ['u']],
      ['overdue', ['o']],
    ]);
  });
});

describe('opportunities', () => {
  const now = new Date('2026-08-01T12:00:00Z');
  const base = { kind: 'event' as const, created_at: '2026-07-01T00:00:00Z', location: null, event_date: null, deadline: null };

  it('treats rows past their dates as stale, and rolling ones never', () => {
    expect(isStale({ deadline: '2026-07-30T00:00:00Z', event_date: null }, now)).toBe(true);
    expect(isStale({ deadline: '2026-07-30T00:00:00Z', event_date: '2026-08-10T00:00:00Z' }, now)).toBe(false);
    expect(isStale({ deadline: null, event_date: null }, now)).toBe(false);
  });

  it('sorts soonest first, with rolling ones as if a week out', () => {
    const rows = [
      { ...base, name: 'Rolling accelerator', kind: 'accelerator' as const },
      { ...base, name: 'In three days', deadline: '2026-08-04T12:00:00Z' },
      { ...base, name: 'In a month', deadline: '2026-09-01T12:00:00Z' },
    ];
    expect(sortOpportunities(rows, now).map((r) => r.name)).toEqual(['In three days', 'Rolling accelerator', 'In a month']);
  });

  it('describes a row', () => {
    expect(opportunityMeta({ deadline: '2026-08-09T23:59:59Z', event_date: null, location: 'Online' })).toBe('Deadline 10 Aug · Online');
    expect(opportunityMeta({ deadline: null, event_date: null, location: null })).toBe('Rolling');
  });
});

describe('live feed', () => {
  const now = new Date(2026, 10, 12, 9, 0);

  it('labels today and yesterday', () => {
    expect(dayLabel(new Date(2026, 10, 12, 8, 0).toISOString(), now)).toBe('Today');
    expect(dayLabel(new Date(2026, 10, 11, 8, 0).toISOString(), now)).toBe('Yesterday');
  });

  it('groups rows by day in order', () => {
    const rows = [
      { id: 'a', first_seen_at: new Date(2026, 10, 12, 8).toISOString() },
      { id: 'b', first_seen_at: new Date(2026, 10, 12, 7).toISOString() },
      { id: 'c', first_seen_at: new Date(2026, 10, 11, 7).toISOString() },
      { id: 'd', first_seen_at: null },
    ];
    expect(groupByDay(rows, now).map((g) => [g.label, g.rows.map((r) => r.id)])).toEqual([
      ['Today', ['a', 'b']],
      ['Yesterday', ['c']],
    ]);
  });

  it('marks detections from the last day as new', () => {
    expect(isNew(new Date(2026, 10, 11, 10).toISOString(), now)).toBe(true);
    expect(isNew(new Date(2026, 10, 10, 10).toISOString(), now)).toBe(false);
  });
});
