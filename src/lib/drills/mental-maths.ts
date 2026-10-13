/**
 * The ranked Mental Maths drill: the four operations, one question at a time, and a
 * correct answer submits itself as it is typed. Wrong keystrokes cost nothing, so the
 * score is simply how many are cleared before the clock runs out.
 *
 * The operand ranges are the standard speed-test ones (as in Zetamac). Align them with
 * simplytk.com's generator once its code is available, so app and site runs compare.
 */
export const MENTAL_MATHS = {
  durations: [30, 60, 120, 300] as const,
  /** The site ranks the 120 second game with all four operations. */
  rankedDuration: 120,
  add: { left: [2, 100], right: [2, 100] },
  multiply: { left: [2, 12], right: [2, 100] },
} as const;

export type Operation = '+' | '−' | '×' | '÷';

export type MathsQuestion = { left: number; op: Operation; right: number; answer: number };

type Random = () => number;

function between(random: Random, [min, max]: readonly [number, number]) {
  return min + Math.floor(random() * (max - min + 1));
}

/**
 * Subtraction and division are addition and multiplication run backwards, so answers are
 * always whole and never negative: easy to type on a phone's number pad.
 */
export function mathsQuestion(random: Random = Math.random): MathsQuestion {
  const op = (['+', '−', '×', '÷'] as const)[Math.floor(random() * 4)];
  if (op === '+' || op === '−') {
    const a = between(random, MENTAL_MATHS.add.left);
    const b = between(random, MENTAL_MATHS.add.right);
    return op === '+' ? { left: a, op, right: b, answer: a + b } : { left: a + b, op, right: a, answer: b };
  }
  const a = between(random, MENTAL_MATHS.multiply.left);
  const b = between(random, MENTAL_MATHS.multiply.right);
  return op === '×' ? { left: a, op, right: b, answer: a * b } : { left: a * b, op, right: a, answer: b };
}

/** A question that isn't the same as the one just answered. */
export function nextMathsQuestion(previous: MathsQuestion | null, random: Random = Math.random) {
  for (;;) {
    const question = mathsQuestion(random);
    if (
      !previous ||
      question.left !== previous.left ||
      question.op !== previous.op ||
      question.right !== previous.right
    ) {
      return question;
    }
  }
}

/** Whether what the player has typed is the answer. Spaces and thousands commas are ignored. */
export function isMathsAnswer(input: string, question: MathsQuestion) {
  const digits = input.replace(/[\s,]/g, '');
  return /^\d+$/.test(digits) && Number(digits) === question.answer;
}
