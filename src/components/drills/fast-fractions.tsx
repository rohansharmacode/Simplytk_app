import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DrillShell } from '@/components/drills/drill-shell';
import { Radius, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { FAST_FRACTIONS, nextFractionQuestion } from '@/lib/drills/fast-fractions';
import { hapticCorrect, hapticWrong } from '@/lib/haptics';

export function FastFractionsDrill() {
  return (
    <DrillShell
      slug="fast-fractions"
      intro="A fraction appears with five decimals. Pick the one it equals."
      rules={[
        'Options are told apart at three decimal places: 7/16 is 0.4375, 3/8 is 0.375.',
        'A wrong pick voids the question. Pick the right one to move on, but it won’t score.',
        'Halves through twentieths, plus 32nds and 64ths.',
      ]}
      durations={FAST_FRACTIONS.durations}
      defaultDuration={FAST_FRACTIONS.durations[0]}>
      {({ addPoint }) => <Board onPoint={addPoint} />}
    </DrillShell>
  );
}

function Board({ onPoint }: { onPoint: () => void }) {
  const palette = usePalette();
  const [question, setQuestion] = useState(() => nextFractionQuestion(null));
  const [wrongPicks, setWrongPicks] = useState<number[]>([]);
  const voided = wrongPicks.length > 0;

  const pick = (index: number) => {
    if (index === question.answerIndex) {
      if (!voided) onPoint();
      hapticCorrect();
      setQuestion(nextFractionQuestion(question));
      setWrongPicks([]);
    } else if (!wrongPicks.includes(index)) {
      hapticWrong();
      setWrongPicks([...wrongPicks, index]);
    }
  };

  return (
    <View style={styles.container}>
      <View
        style={styles.fraction}
        accessible
        accessibilityRole="header"
        accessibilityLabel={`${question.numerator} over ${question.denominator}`}>
        <Text style={[styles.term, { color: palette.text }]}>{question.numerator}</Text>
        <View style={[styles.bar, { backgroundColor: palette.text }]} />
        <Text style={[styles.term, { color: palette.text }]}>{question.denominator}</Text>
      </View>

      <View style={styles.options}>
        {question.options.map((option, index) => {
          const wrong = wrongPicks.includes(index);
          return (
            <Pressable
              key={`${question.numerator}/${question.denominator}:${option}`}
              accessibilityRole="button"
              accessibilityState={{ disabled: wrong }}
              disabled={wrong}
              onPress={() => pick(index)}
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor: pressed ? palette.muted : palette.surface,
                  borderColor: wrong ? palette.danger : palette.border,
                },
              ]}>
              <Text
                style={[
                  styles.optionLabel,
                  { color: wrong ? palette.danger : palette.text },
                  wrong && styles.struck,
                ]}>
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.hint, { color: voided ? palette.danger : 'transparent' }]}>
        Voided: this one won’t score.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: Spacing.five,
    gap: Spacing.five,
  },
  fraction: {
    alignItems: 'center',
    marginTop: Spacing.three,
    minWidth: 96,
  },
  term: {
    fontSize: 44,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  bar: {
    alignSelf: 'stretch',
    height: 3,
    borderRadius: 2,
    marginVertical: Spacing.one,
  },
  options: {
    alignSelf: 'stretch',
    gap: Spacing.two,
  },
  option: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderWidth: 1.5,
    borderRadius: Radius.card,
  },
  optionLabel: {
    fontSize: 22,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  struck: {
    textDecorationLine: 'line-through',
  },
  hint: {
    fontSize: 14,
  },
});
