import { useCallback, useEffect, useEffectEvent, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { getBestScore, recordScore } from '@/lib/best-scores';
import { hapticFinished } from '@/lib/haptics';

type Phase = 'ready' | 'playing' | 'done';

type Result = { seconds: number; score: number; best: number | null; newBest: boolean };

export type DrillRun = {
  /** Count one point towards this run's score. */
  addPoint: () => void;
};

type Props = {
  slug: string;
  intro: string;
  rules: string[];
  durations: readonly number[];
  defaultDuration: number;
  /** The game board, shown while a run is playing. Remounted for every run. */
  children: (run: DrillRun) => ReactNode;
};

function formatClock(seconds: number) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * The frame every native drill shares: pick a time, play against the clock, see the score
 * against your best. Runs are practice runs kept on the device (see src/lib/best-scores.ts).
 */
export function DrillShell({ slug, intro, rules, durations, defaultDuration, children }: Props) {
  const palette = usePalette();
  const [phase, setPhase] = useState<Phase>('ready');
  const [duration, setDuration] = useState(defaultDuration);
  const [score, setScore] = useState(0);
  const [remaining, setRemaining] = useState(defaultDuration);
  const [run, setRun] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const endsAt = useRef(0);
  const variant = `${duration}s`;
  // Read on every render, so it follows the selected time and a new best shows at once.
  const best = getBestScore(slug, variant);

  const start = () => {
    setScore(0);
    setRemaining(duration);
    endsAt.current = Date.now() + duration * 1000;
    setRun((n) => n + 1);
    setPhase('playing');
  };

  const addPoint = useCallback(() => setScore((s) => s + 1), []);

  // An effect event, so the timer sees the latest score without restarting on every point.
  const finish = useEffectEvent(() => {
    const newBest = recordScore(slug, variant, score);
    setResult({ seconds: duration, score, best: getBestScore(slug, variant), newBest });
    hapticFinished();
    setPhase('done');
  });

  useEffect(() => {
    if (phase !== 'playing') return;
    const timer = setInterval(() => {
      const left = (endsAt.current - Date.now()) / 1000;
      setRemaining(left);
      if (left <= 0) {
        clearInterval(timer);
        finish();
      }
    }, 200);
    return () => clearInterval(timer);
  }, [phase]);

  if (phase === 'playing') {
    const fraction = Math.max(0, Math.min(1, remaining / duration));
    return (
      <View style={[styles.flex, { backgroundColor: palette.background }]}>
        <View style={[styles.statusBar, { borderColor: palette.border, backgroundColor: palette.surface }]}>
          <Text style={[styles.status, { color: palette.text }]} accessibilityLabel="Time left">
            {formatClock(remaining)}
          </Text>
          <Text style={[styles.status, { color: palette.text }]} accessibilityLabel="Score">
            {score}
          </Text>
        </View>
        <View style={[styles.track, { backgroundColor: palette.muted }]}>
          <View
            style={[styles.progress, { backgroundColor: palette.tint, width: `${fraction * 100}%` }]}
          />
        </View>
        <View key={run} style={styles.flex}>
          {children({ addPoint })}
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: palette.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic">
      {phase === 'done' && result ? (
        <View style={[styles.card, styles.result, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={[styles.caption, { color: palette.textSecondary }]}>
            {formatClock(result.seconds)} RUN
          </Text>
          <Text style={[styles.bigScore, { color: palette.text }]} accessibilityLabel="Final score">
            {result.score}
          </Text>
          <Text style={[styles.body, { color: result.newBest ? palette.success : palette.textSecondary }]}>
            {result.newBest
              ? 'New personal best'
              : result.best !== null
                ? `Your best: ${result.best}`
                : 'No score this time'}
          </Text>
        </View>
      ) : (
        <View style={styles.intro}>
          <Text style={[styles.body, { color: palette.text }]}>{intro}</Text>
          {rules.map((rule) => (
            <View key={rule} style={styles.rule}>
              <Text style={[styles.body, { color: palette.tint }]}>•</Text>
              <Text style={[styles.body, styles.flex, { color: palette.textSecondary }]}>{rule}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={[styles.caption, { color: palette.textSecondary }]}>TIME</Text>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {durations.map((seconds) => {
            const selected = seconds === duration;
            return (
              <Pressable
                key={seconds}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setDuration(seconds)}
                style={[
                  styles.chip,
                  { borderColor: selected ? palette.tint : palette.border },
                  selected && { backgroundColor: palette.tint },
                ]}>
                <Text style={[styles.chipLabel, { color: selected ? palette.onTint : palette.text }]}>
                  {seconds < 60 ? `${seconds}s` : `${seconds / 60} min`}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.note, { color: palette.textSecondary }]}>
          {best !== null ? `Your best at this length: ${best}` : 'No score at this length yet'}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={start}
        style={({ pressed }) => [styles.start, { backgroundColor: palette.tint, opacity: pressed ? 0.8 : 1 }]}>
        <Text style={[styles.startLabel, { color: palette.onTint }]}>
          {phase === 'done' ? 'Play again' : 'Start'}
        </Text>
      </Pressable>

      <Text style={[styles.note, { color: palette.textSecondary }]}>
        Practice run: your best is saved on this phone. Ranked runs and leaderboards are on
        simplytk.com for now.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.five,
  },
  intro: {
    gap: Spacing.two,
  },
  rule: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
  },
  caption: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  note: {
    fontSize: 13,
    lineHeight: 18,
  },
  section: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    minWidth: 72,
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  chipLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  start: {
    alignItems: 'center',
    paddingVertical: Spacing.four,
    borderRadius: Radius.pill,
  },
  startLabel: {
    fontSize: 17,
    fontWeight: '700',
  },
  card: {
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  result: {
    alignItems: 'center',
    padding: Spacing.five,
    gap: Spacing.one,
  },
  bigScore: {
    fontSize: 64,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  status: {
    fontSize: 20,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: 3,
  },
  progress: {
    height: 3,
  },
});
