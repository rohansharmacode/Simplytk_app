import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { DrillShell } from '@/components/drills/drill-shell';
import { Radius, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { MENTAL_MATHS, isMathsAnswer, nextMathsQuestion } from '@/lib/drills/mental-maths';
import { hapticCorrect } from '@/lib/haptics';

export function MentalMathsDrill() {
  return (
    <DrillShell
      slug="mental-maths"
      intro="The four operations, one question at a time, as fast as you can."
      rules={[
        'A right answer submits itself as you type it, and the next one appears.',
        'A wrong keystroke costs nothing. Just fix it and carry on.',
        'Your score is how many you clear. The site ranks the 2 minute run.',
      ]}
      durations={MENTAL_MATHS.durations}
      defaultDuration={MENTAL_MATHS.rankedDuration}>
      {({ addPoint }) => <Board onPoint={addPoint} />}
    </DrillShell>
  );
}

function Board({ onPoint }: { onPoint: () => void }) {
  const palette = usePalette();
  const [question, setQuestion] = useState(() => nextMathsQuestion(null));
  const [input, setInput] = useState('');

  const onChangeText = (text: string) => {
    const digits = text.replace(/\D/g, '');
    if (isMathsAnswer(digits, question)) {
      onPoint();
      hapticCorrect();
      setQuestion(nextMathsQuestion(question));
      setInput('');
    } else {
      setInput(digits);
    }
  };

  return (
    <View style={styles.container}>
      <Text
        style={[styles.question, { color: palette.text }]}
        accessibilityRole="header"
        accessibilityLabel={`${question.left} ${question.op} ${question.right}`}>
        {question.left} {question.op} {question.right}
      </Text>
      <TextInput
        value={input}
        onChangeText={onChangeText}
        autoFocus
        keyboardType="number-pad"
        inputMode="numeric"
        autoComplete="off"
        autoCorrect={false}
        accessibilityLabel="Answer"
        placeholder="?"
        placeholderTextColor={palette.textSecondary}
        selectionColor={palette.tint}
        style={[
          styles.input,
          { color: palette.text, backgroundColor: palette.surface, borderColor: palette.tint },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: Spacing.five,
    gap: Spacing.five,
  },
  question: {
    marginTop: Spacing.five,
    fontSize: 48,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  input: {
    width: '70%',
    maxWidth: 280,
    textAlign: 'center',
    fontSize: 40,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    paddingVertical: Spacing.three,
    borderWidth: 2,
    borderRadius: Radius.card,
  },
});
