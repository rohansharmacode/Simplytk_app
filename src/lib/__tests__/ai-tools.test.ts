import {
  averageScore,
  canScore,
  countWords,
  formatClock,
  isCvFile,
  quotaLine,
  scoreTone,
  statementCount,
  tierNote,
} from '@/lib/ai-tools';

const quota = { pass: false, freePerDay: 1, freeLeft: 1, credits: 0, quickPerDay: 2, quickLeft: 3 };

describe('AI tools', () => {
  it('accepts the CV types the site reads', () => {
    expect(isCvFile('cv.PDF')).toBe(true);
    expect(isCvFile('cv.docx')).toBe(true);
    expect(isCvFile('cv.pages')).toBe(false);
  });

  it('colours scores by share', () => {
    expect(scoreTone(8)).toBe('green');
    expect(scoreTone(6)).toBe('amber');
    expect(scoreTone(3)).toBe('red');
    expect(scoreTone(72, 100)).toBe('amber');
  });

  it('describes what is left today without selling anything', () => {
    expect(quotaLine(quota, 'review')).toBe('1 full-depth review left today, then 2 quick ones.');
    expect(quotaLine({ ...quota, freeLeft: 0, quickLeft: 1 }, 'review')).toBe(
      "Today's full-depth review is used. 1 quick review left.",
    );
    expect(quotaLine({ ...quota, freeLeft: 0, quickLeft: 0 }, 'review')).toBe("Today's reviews are used. They come back tomorrow.");
    expect(quotaLine({ ...quota, pass: true }, 'rating')).toBe('Your pass covers every rating at full depth.');
    expect(quotaLine(null, 'review')).toBeNull();
    expect(tierNote('quick')).toMatch(/faster model/);
    expect(tierNote('full')).toBeNull();
  });

  it('counts and times', () => {
    expect(countWords('  one two\nthree ')).toBe(3);
    expect(countWords('')).toBe(0);
    expect(formatClock(95)).toBe('1:35');
    expect(formatClock(-3)).toBe('0:00');
    expect(averageScore([{ score: 6 }, { score: null }, { score: 7 }])).toBe(6.5);
    expect(averageScore([{ score: null }])).toBeNull();
    expect(canScore('too short')).toBe(false);
  });

  it('counts a statement against the UCAS limit', () => {
    expect(statementCount(['a'.repeat(3000), 'b'.repeat(1200), ''], 4000)).toEqual({
      text: '4,200 of 4,000 characters',
      over: true,
    });
  });
});
