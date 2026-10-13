/**
 * Fast Fractions: a fraction and five decimals to pick from. Options are told apart at
 * three decimal places. A wrong pick voids the question: the right answer still moves on,
 * but only questions answered first time score.
 *
 * The site doesn't publish its clock, so the durations here are a guess to align with
 * simplytk.com's version once its code is available.
 */
export const FAST_FRACTIONS = {
  durations: [60, 120] as const,
  /** Halves through twentieths, plus the binary ones prices move in. */
  denominators: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 32, 64],
  options: 5,
} as const;

export type FractionQuestion = {
  numerator: number;
  denominator: number;
  /** Decimals as shown, the correct one at `answerIndex`. */
  options: string[];
  answerIndex: number;
};

type Random = () => number;

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** Up to four decimal places, without trailing zeros: 0.5, 0.375, 0.4375, 0.3333. */
export function formatDecimal(value: number) {
  return value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
}

/** Values within the same thousandth count as the same option. */
const thousandths = (value: number) => Math.round(value * 1000);

function shuffle<T>(items: T[], random: Random) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/**
 * Wrong options are nearby fractions (a numerator or denominator off by one or two), so
 * they are the mistakes a rushed conversion makes rather than obviously wrong numbers.
 */
function distractors(numerator: number, denominator: number, random: Random) {
  const value = numerator / denominator;
  const seen = new Set([thousandths(value)]);
  const candidates: number[] = [];
  for (let d = Math.max(2, denominator - 2); d <= denominator + 2; d++) {
    for (let n = Math.max(1, numerator - 2); n <= numerator + 2; n++) {
      const candidate = n / d;
      if (candidate > 0 && candidate < 1) candidates.push(candidate);
    }
  }
  const picked: number[] = [];
  for (const candidate of shuffle(candidates, random)) {
    if (picked.length === FAST_FRACTIONS.options - 1) break;
    if (seen.has(thousandths(candidate))) continue;
    seen.add(thousandths(candidate));
    picked.push(candidate);
  }
  // Tiny denominators (halves, thirds) have few neighbours; pad with nearby values.
  for (let step = 1; picked.length < FAST_FRACTIONS.options - 1; step++) {
    for (const candidate of [value + step * 0.0625, value - step * 0.0625]) {
      if (picked.length === FAST_FRACTIONS.options - 1) break;
      if (candidate <= 0 || candidate >= 1 || seen.has(thousandths(candidate))) continue;
      seen.add(thousandths(candidate));
      picked.push(candidate);
    }
  }
  return picked;
}

/** A proper fraction in lowest terms, with five options to pick from. */
export function fractionQuestion(random: Random = Math.random): FractionQuestion {
  const { denominators } = FAST_FRACTIONS;
  const denominator = denominators[Math.floor(random() * denominators.length)];
  let numerator: number;
  do {
    numerator = 1 + Math.floor(random() * (denominator - 1));
  } while (gcd(numerator, denominator) !== 1);

  const answer = numerator / denominator;
  const values = shuffle([answer, ...distractors(numerator, denominator, random)], random);
  return {
    numerator,
    denominator,
    options: values.map(formatDecimal),
    answerIndex: values.indexOf(answer),
  };
}

/** A question that isn't the same fraction as the one just answered. */
export function nextFractionQuestion(previous: FractionQuestion | null, random: Random = Math.random) {
  for (;;) {
    const question = fractionQuestion(random);
    if (
      !previous ||
      question.numerator !== previous.numerator ||
      question.denominator !== previous.denominator
    ) {
      return question;
    }
  }
}
