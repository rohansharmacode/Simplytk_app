import {
  answerText,
  applyKey,
  createRecorder,
  formatDuration,
  inputModeFor,
  isCorrect,
  MIN_GAP_MS,
  parseNumber,
  promptFor,
  SKIP,
} from '../daily/answers';
import type { DailyProblem } from '../site-api';

const sequence: DailyProblem = { kind: 'sequence', terms: ['1', '2', '4', '8'], answer: { n: 16, d: 1 }, id: 1 };
const thirds: DailyProblem = { kind: 'sequence', terms: ['5000', '2500/3'], answer: { n: 5000, d: 3 }, id: 2 };
const maths: DailyProblem = { kind: 'mental_maths', text: '12 × 13', answer: 156 };
const fraction: DailyProblem = { kind: 'fast_fractions', numerator: 3, denominator: 8, answer: '0.375' };
const fractionChoice: DailyProblem = { ...fraction, options: ['0.375', '0.38', '0.35', '0.4', '0.3'] };
const sprint: DailyProblem = {
  kind: 'sprint',
  id: 'a1',
  type: 'analogy',
  prompt: 'Hot is to cold as up is to?',
  options: ['Down', 'Left', 'Over', 'Under'],
  answer: 0,
  explanation: '',
};

describe('marking, as the website does', () => {
  it('marks mental maths', () => {
    expect(isCorrect(maths, '156')).toBe(true);
    expect(isCorrect(maths, '155')).toBe(false);
    expect(isCorrect(maths, '')).toBe(false);
  });

  it('marks fractions to three decimal places', () => {
    expect(isCorrect(fraction, '0.375')).toBe(true);
    expect(isCorrect(fraction, '.375')).toBe(true);
    expect(isCorrect(fraction, '0.38')).toBe(false);
  });

  it('marks sequences as exact fractions, with rounded decimals for non-whole answers', () => {
    expect(isCorrect(sequence, '16')).toBe(true);
    expect(isCorrect(sequence, '32/2')).toBe(true);
    expect(isCorrect(sequence, '16.0')).toBe(true);
    expect(isCorrect(sequence, '15')).toBe(false);
    expect(isCorrect(thirds, '5000/3')).toBe(true);
    expect(isCorrect(thirds, '1666.667')).toBe(true);
    expect(isCorrect(thirds, '1666')).toBe(false);
  });

  it('marks multiple choice by the option text', () => {
    expect(isCorrect(sprint, 'Down')).toBe(true);
    expect(isCorrect(sprint, 'Under')).toBe(false);
    expect(isCorrect(fractionChoice, '0.375')).toBe(true);
  });

  it('never marks a skip right', () => {
    expect(isCorrect(maths, SKIP)).toBe(false);
  });
});

describe('input', () => {
  it('uses the keypad for numbers and buttons for choices', () => {
    expect(inputModeFor(sequence)).toEqual({ kind: 'number', fraction: true });
    expect(inputModeFor(maths)).toEqual({ kind: 'number', fraction: false });
    expect(inputModeFor(fraction)).toEqual({ kind: 'number', fraction: false });
    expect(inputModeFor(fractionChoice)).toEqual({ kind: 'choice', options: fractionChoice.options });
    expect(inputModeFor(sprint).kind).toBe('choice');
  });

  it('types on the keypad', () => {
    const type = (keys: string[], fraction = true) => keys.reduce((v, k) => applyKey(v, k, fraction), '');
    expect(type(['1', '2', 'back', '3'])).toBe('13');
    expect(type(['5', '-'])).toBe('-5');
    expect(type(['5', '-', '-'])).toBe('5');
    expect(type(['3', '/', '4', '/'])).toBe('3/4');
    expect(type(['/', '3'])).toBe('3');
    expect(type(['3', '/', '4'], false)).toBe('34');
    expect(type(['1', '.', '5', '.'])).toBe('1.5');
    expect(type(['1', '/', '2', '.', '5'])).toBe('1/2.5');
    expect(type(Array(30).fill('9')).length).toBe(20);
  });

  it('parses what the keypad can type', () => {
    expect(parseNumber('-7/2')).toEqual({ value: { n: -7, d: 2 }, isDecimal: false });
    expect(parseNumber('2.50')).toEqual({ value: { n: 250, d: 100 }, isDecimal: true });
    expect(parseNumber('1/0')).toBeNull();
    expect(parseNumber('-')).toBeNull();
  });
});

describe('prompts and answers', () => {
  it('writes each kind of question', () => {
    expect(promptFor(sequence)).toEqual({ kicker: 'Next in the sequence', text: '1, 2, 4, 8, ?' });
    expect(promptFor(fraction).text).toBe('3/8');
    expect(promptFor(sprint).kicker).toBe('Analogy');
  });

  it('writes the right answer for the review', () => {
    expect(answerText(sequence)).toBe('16');
    expect(answerText(thirds)).toBe('5000/3');
    expect(answerText({ ...sequence, answer: { n: 4, d: -6 } })).toBe('-2/3');
    expect(answerText(sprint)).toBe('Down');
    expect(answerText(maths)).toBe('156');
  });
});

describe('createRecorder', () => {
  it('records answers in order, timed from the start, never faster than the site allows', () => {
    const recorder = createRecorder(1000);
    recorder.record('12', 3500);
    recorder.record('7', 3550);
    recorder.record(SKIP, 9000);
    expect(recorder.events).toEqual([
      { i: 0, a: '12', t: 2500 },
      { i: 1, a: '7', t: 2500 + MIN_GAP_MS },
      { i: 2, a: SKIP, t: 8000 },
    ]);
  });

  it('formats durations as minutes and seconds', () => {
    expect(formatDuration(83_400)).toBe('1:23');
    expect(formatDuration(0)).toBe('0:00');
  });
});
