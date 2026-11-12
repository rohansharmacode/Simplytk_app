import { funnel, groupByStage, localDay, stageOf, stageToStatus, STAGES } from '@/lib/applications/stages';

describe('stageOf', () => {
  it('reads a done stage from the completed stamp', () => {
    expect(stageOf({ status: 'online_test', stage_completed_at: '2026-11-01T00:00:00Z' })).toBe('online_test_done');
    expect(stageOf({ status: 'interview', stage_completed_at: '2026-11-01T00:00:00Z' })).toBe('interview_done');
    expect(stageOf({ status: 'interview', stage_completed_at: null })).toBe('interview');
  });

  it('ignores a stamp on a stage with no done step, and unknown statuses', () => {
    expect(stageOf({ status: 'applied', stage_completed_at: '2026-11-01T00:00:00Z' })).toBe('applied');
    expect(stageOf({ status: 'mystery' })).toBe('not_started');
    expect(stageOf({})).toBe('not_started');
  });
});

describe('stageToStatus', () => {
  it('round-trips every stage', () => {
    for (const stage of STAGES) {
      const { status, completed } = stageToStatus(stage);
      expect(stageOf({ status, stage_completed_at: completed ? 'x' : null })).toBe(stage);
    }
  });
});

describe('groupByStage', () => {
  it('puts rows in the screen’s sections, skipping empty ones and keeping order', () => {
    const rows = [
      { id: 'a', status: 'applied' },
      { id: 'b', status: 'offer' },
      { id: 'c', status: 'interview', stage_completed_at: 'x' },
      { id: 'd', status: 'applied' },
    ];
    expect(groupByStage(rows).map((s) => [s.key, s.rows.map((r) => r.id)])).toEqual([
      ['applied', ['a', 'd']],
      ['in_progress', ['c']],
      ['offer', ['b']],
    ]);
  });
});

describe('funnel', () => {
  it('counts internships only', () => {
    expect(
      funnel([
        { status: 'not_started' },
        { status: 'applied' },
        { status: 'interview' },
        { status: 'offer' },
        { status: 'rejected' },
        { status: 'applied', kind: 'event' },
      ]),
    ).toEqual({ tracked: 5, applied: 4, interviews: 2, offers: 1 });
  });
});

describe('localDay', () => {
  it('uses the phone’s own calendar day', () => {
    expect(localDay(new Date(2026, 0, 5, 0, 30))).toBe('2026-01-05');
  });
});
