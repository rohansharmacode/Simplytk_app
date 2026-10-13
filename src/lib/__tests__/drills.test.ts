import { DRILL_GROUPS, drillBySlug, nativeDrillForPath } from '../drills/catalogue';
import {
  FAST_FRACTIONS,
  formatDecimal,
  fractionQuestion,
  nextFractionQuestion,
} from '../drills/fast-fractions';
import { MENTAL_MATHS, isMathsAnswer, mathsQuestion, nextMathsQuestion } from '../drills/mental-maths';

/** Deterministic random numbers (mulberry32), so failures reproduce. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

describe('catalogue', () => {
  it('lists every drill once', () => {
    const slugs = DRILL_GROUPS.flatMap((group) => group.drills.map((drill) => drill.slug));
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs).toHaveLength(35);
  });

  it('finds native drills by site path', () => {
    expect(nativeDrillForPath('/mental-maths')?.title).toBe('Mental Maths');
    expect(nativeDrillForPath('fast-fractions/')?.title).toBe('Fast Fractions');
    expect(nativeDrillForPath('/sequences')).toBeUndefined();
    expect(nativeDrillForPath('/nonsense')).toBeUndefined();
    expect(drillBySlug('sequences')?.native).toBeUndefined();
  });
});

describe('mental maths', () => {
  const random = seeded(1);
  const questions = Array.from({ length: 2000 }, () => mathsQuestion(random));

  it('uses all four operations', () => {
    expect(new Set(questions.map((q) => q.op))).toEqual(new Set(['+', '−', '×', '÷']));
  });

  it('only asks questions with whole, non-negative answers', () => {
    for (const q of questions) {
      const exact = { '+': q.left + q.right, '−': q.left - q.right, '×': q.left * q.right, '÷': q.left / q.right }[q.op];
      expect(q.answer).toBe(exact);
      expect(Number.isInteger(q.answer)).toBe(true);
      expect(q.answer).toBeGreaterThanOrEqual(2);
    }
  });

  it('keeps operands in range', () => {
    const [min, max] = MENTAL_MATHS.multiply.left;
    for (const q of questions.filter((q) => q.op === '×')) {
      expect(q.left).toBeGreaterThanOrEqual(min);
      expect(q.left).toBeLessThanOrEqual(max);
    }
    for (const q of questions.filter((q) => q.op === '+')) {
      expect(q.left).toBeLessThanOrEqual(100);
      expect(q.right).toBeLessThanOrEqual(100);
    }
  });

  it('never repeats the question just answered', () => {
    const always = () => 0;
    const first = nextMathsQuestion(null, always);
    let calls = 0;
    // The first draw repeats `first`; the next one must not be accepted as-is.
    const second = nextMathsQuestion(first, () => (calls++ < 3 ? 0 : 0.99));
    expect(second).not.toEqual(first);
  });

  it('accepts the answer however it is typed', () => {
    const q = { left: 12, op: '×' as const, right: 95, answer: 1140 };
    expect(isMathsAnswer('1140', q)).toBe(true);
    expect(isMathsAnswer(' 1,140 ', q)).toBe(true);
    expect(isMathsAnswer('114', q)).toBe(false);
    expect(isMathsAnswer('', q)).toBe(false);
    expect(isMathsAnswer('1140.5', q)).toBe(false);
  });
});

describe('fast fractions', () => {
  const random = seeded(7);
  const questions = Array.from({ length: 2000 }, () => fractionQuestion(random));

  it('asks proper fractions in lowest terms', () => {
    for (const q of questions) {
      expect(FAST_FRACTIONS.denominators).toContain(q.denominator);
      expect(q.numerator).toBeGreaterThanOrEqual(1);
      expect(q.numerator).toBeLessThan(q.denominator);
      expect(gcd(q.numerator, q.denominator)).toBe(1);
    }
  });

  it('offers five options that differ at three decimal places, one of them right', () => {
    for (const q of questions) {
      expect(q.options).toHaveLength(5);
      const thousandths = q.options.map((option) => Math.round(Number(option) * 1000));
      expect(new Set(thousandths).size).toBe(5);
      expect(q.options[q.answerIndex]).toBe(formatDecimal(q.numerator / q.denominator));
      for (const option of q.options) {
        expect(Number(option)).toBeGreaterThan(0);
        expect(Number(option)).toBeLessThan(1);
      }
    }
  });

  it('puts the answer in every position', () => {
    expect(new Set(questions.map((q) => q.answerIndex))).toEqual(new Set([0, 1, 2, 3, 4]));
  });

  it('shows decimals the way the site does', () => {
    expect(formatDecimal(7 / 16)).toBe('0.4375');
    expect(formatDecimal(3 / 8)).toBe('0.375');
    expect(formatDecimal(1 / 2)).toBe('0.5');
    expect(formatDecimal(1 / 3)).toBe('0.3333');
  });

  it('never repeats the fraction just answered', () => {
    const r = seeded(3);
    let previous = nextFractionQuestion(null, r);
    for (let i = 0; i < 500; i++) {
      const next = nextFractionQuestion(previous, r);
      expect(`${next.numerator}/${next.denominator}`).not.toBe(
        `${previous.numerator}/${previous.denominator}`,
      );
      previous = next;
    }
  });
});
