/**
 * Every drill on simplytk.com/explore, in the site's groups and order. Drills marked
 * `native` are played in the app (src/app/play/[slug].tsx); the rest open their site page
 * until they are ported.
 */
export type Drill = {
  /** The drill's path on simplytk.com, without the slash. */
  slug: string;
  title: string;
  blurb: string;
  native?: true;
};

export type DrillGroup = { title: string; drills: Drill[] };

export const DRILL_GROUPS: DrillGroup[] = [
  {
    title: 'Speed and numeracy',
    drills: [
      { slug: 'daily', title: 'Daily Challenge', blurb: 'Eight sequences a day, the same for everyone, with a streak.' },
      { slug: 'mental-maths', title: 'Mental Maths', blurb: 'Four operations against the clock. A right answer submits itself.', native: true },
      { slug: 'sequences', title: 'Sequences', blurb: 'Find the next number in the pattern, against the clock.' },
      { slug: 'sequences-hard', title: 'Sequences (Hard)', blurb: 'The hard tier of the sequences bank only.' },
      { slug: 'fast-fractions', title: 'Fast Fractions', blurb: 'Pick the decimal for each fraction until it is automatic.', native: true },
      { slug: 'numerical-reasoning', title: 'Numerical Reasoning', blurb: 'Read a table of business figures and answer one question about it.' },
      { slug: 'data-statements', title: 'Data Statements', blurb: 'Six tabs of company data: true, false or cannot say.' },
    ],
  },
  {
    title: 'Markets and estimation',
    drills: [
      { slug: 'make-market', title: 'Make a Market', blurb: 'Quote a two sided market and let informed flow trade against you.' },
      { slug: 'pot-odds', title: 'Pot Odds', blurb: 'Break-even equity and bluff frequencies, to the nearest percent.' },
      { slug: 'dice-markets', title: 'Dice Markets', blurb: "Buy, sell or pass on a dealer's quote for the sum of five dice." },
      { slug: 'card-markets', title: 'Card Markets', blurb: 'The same game with cards, where the deck itself carries information.' },
      { slug: 'fermi', title: 'Fermi Estimation', blurb: 'Order-of-magnitude questions answered with a confidence interval.' },
      { slug: 'probability', title: 'Probability', blurb: 'Timed multiple choice probability, where wrong answers deduct.' },
      { slug: 'probability-hard', title: 'Probability (Hard)', blurb: '30 questions, 90 seconds each, pick the closest.' },
    ],
  },
  {
    title: 'Cognitive and reaction',
    drills: [
      { slug: 'switch', title: 'Switch', blurb: 'Name the four digit operator that rearranged one row into another.' },
      { slug: 'operators', title: 'Operators', blurb: 'Run the shapes through the operators and fill the gap.' },
      { slug: 'inductive-reasoning', title: 'Inductive Reasoning', blurb: 'Nine tiles, one breaks the hidden rule. Find it.' },
      { slug: 'motion', title: 'Motion', blurb: 'Slide the blocks and get the ball to the exit in the fewest moves.' },
      { slug: 'figure-series', title: 'Figure Series', blurb: 'Four figures in a row. Work out the rules and pick the fifth.' },
      { slug: 'logical-statements', title: 'Logical Statements', blurb: 'Always, sometimes or never true?' },
      { slug: 'verbal-statements', title: 'Verbal Statements', blurb: 'Six tabs of text about one company: true, false or cannot say.' },
      { slug: 'situational-strengths', title: 'Situational Strengths', blurb: 'Rank four responses to a spring week scenario.' },
      { slug: 'capp-style-assessment', title: 'Capp-Style Assessment', blurb: 'One sitting in the reported shape of the Rothschild & Co OA.' },
      { slug: 'balloons', title: 'Balloons', blurb: 'Pump for five cents, collect before it bursts.' },
      { slug: 'pymetrics-style-games', title: 'Pymetrics-Style Games', blurb: 'Nine short games in the pymetrics format.' },
      { slug: 'arctic-shores-style-tasks', title: 'Arctic Shores-Style Tasks', blurb: 'Twelve short behaviour tasks, back to back.' },
      { slug: 'wonderlic-style-test', title: 'Wonderlic-Style Test', blurb: 'Fifty mixed questions in twelve minutes.' },
      { slug: 'battery', title: 'Battery', blurb: 'Five short games back to back, with the rules changing every time.' },
      { slug: 'neuro', title: 'Neuro', blurb: 'Four longer cognitive tasks, scored on hits less false alarms.' },
      { slug: 'arrows', title: 'Arrow Game', blurb: 'Answer the centre arrow, ignore the flankers, reverse on red.' },
      { slug: 'reaction-time', title: 'Reaction Time', blurb: 'Wait for green, tap, averaged over five rounds.' },
      { slug: 'memory-digits', title: 'Memory Digits', blurb: 'Memorise a flashing digit sequence and type it back.' },
      { slug: 'sequence-memory', title: 'Sequence Memory', blurb: 'Repeat a growing pattern of squares in order.' },
      { slug: 'visual-memory', title: 'Visual Memory', blurb: 'Memorise flashed tiles on a grid that keeps growing.' },
      { slug: 'chimp-test', title: 'Chimp Test', blurb: 'Numbers appear, then hide. Tap them in ascending order.' },
    ],
  },
];

const BY_SLUG = new Map(DRILL_GROUPS.flatMap((group) => group.drills).map((d) => [d.slug, d]));

export function drillBySlug(slug: string): Drill | undefined {
  return BY_SLUG.get(slug);
}

/** The drill a simplytk.com pathname (like `/mental-maths`) plays natively, if any. */
export function nativeDrillForPath(pathname: string): Drill | undefined {
  const drill = BY_SLUG.get(pathname.replace(/^\/+|\/+$/g, ''));
  return drill?.native ? drill : undefined;
}
