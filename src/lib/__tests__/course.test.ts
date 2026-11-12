import { bandLabel, bandsByQuestion, bandTone, canAsk, coursePathFor, moduleProgress } from '@/lib/course';

describe('course', () => {
  it('names bands and clamps odd values', () => {
    expect(bandLabel(5)).toBe('Interview-ready');
    expect(bandLabel(3)).toBe('Partial answer');
    expect(bandLabel(9)).toBe('Interview-ready');
    expect(bandLabel(-1)).toBe('No attempt');
    expect(bandTone(5)).toBe('green');
    expect(bandTone(4)).toBe('blue');
    expect(bandTone(1)).toBe('red');
  });

  it('builds drill paths with their topic', () => {
    expect(coursePathFor({ label: 'Accounting', to: '/practice', practiceTopic: 'accounting' })).toBe(
      '/practice?topic=accounting',
    );
    expect(coursePathFor({ label: 'Mental maths', to: '/drills/mental-maths' })).toBe('/drills/mental-maths');
  });

  it('counts module progress from the best band per question', () => {
    const bands = bandsByQuestion([
      { questionId: 'a', band: 2 },
      { questionId: 'a', band: 5 },
      { questionId: 'b', band: 3 },
      { questionId: 'z', band: 5 },
    ]);
    expect(bands.get('a')).toBe(5);
    expect(moduleProgress(['a', 'b', 'c'], bands)).toEqual({ answered: 2, ready: 1, total: 3 });
  });

  it('wants a real attempt before asking the tutor', () => {
    expect(canAsk('  yes ')).toBe(true);
    expect(canAsk(' a ')).toBe(false);
  });
});
