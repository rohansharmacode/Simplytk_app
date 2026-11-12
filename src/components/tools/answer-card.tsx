import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Copyable, Field, Note, Points, ScoreBadge } from '@/components/ai-tool';
import { Text } from '@/components/text';
import { Button, Card, Kicker } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { useRun } from '@/hooks/use-run';
import { canScore, MIN_ANSWER_CHARS } from '@/lib/ai-tools';
import { scoreAnswer, type AnswerFeedback } from '@/lib/site-api';

/** What the interviewer thought of an answer: the mark, the verdict, what to fix and a stronger version. */
export function FeedbackView({ feedback }: { feedback: AnswerFeedback }) {
  const palette = usePalette();
  return (
    <View style={styles.feedback}>
      <View style={styles.row}>
        <ScoreBadge score={feedback.score} outOf={10} />
        <Text style={[styles.verdict, { color: palette.text }]}>{feedback.verdict}</Text>
      </View>
      <Points title="To make it stronger" points={feedback.feedback} tone="amber" />
      {feedback.improvedAnswer ? <Copyable title="A stronger version" text={feedback.improvedAnswer} /> : null}
    </View>
  );
}

/** A practice question: tap to answer it, then have it marked. */
export function AnswerCard({
  index,
  question,
  whatTheyTest,
  tip,
  company,
}: {
  index: number;
  question: string;
  whatTheyTest?: string;
  tip?: string;
  company: string;
}) {
  const palette = usePalette();
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const { run, busy, error } = useRun();

  async function mark() {
    const result = await run(() => scoreAnswer(company, question, answer));
    if (result) setFeedback(result);
  }

  return (
    <Card accessibilityLabel={`Question ${index}`} onPress={open ? undefined : () => setOpen(true)} style={styles.card}>
      <Text style={[styles.question, { color: palette.text }]}>{`${index}. ${question}`}</Text>
      {whatTheyTest ? (
        <Text style={[styles.meta, { color: palette.textSecondary }]}>{`What they test: ${whatTheyTest}`}</Text>
      ) : null}
      {open ? (
        <>
          {tip ? (
            <View style={[styles.tip, { backgroundColor: palette.tintSoft }]}>
              <Kicker color={palette.tint}>Tip</Kicker>
              <Text style={[styles.meta, { color: palette.text }]}>{tip}</Text>
            </View>
          ) : null}
          <Field
            label="Your answer"
            multiline
            minHeight={140}
            placeholder="Answer as you would out loud. The keyboard's mic works too."
            value={answer}
            onChangeText={setAnswer}
            hint={canScore(answer) ? undefined : `At least ${MIN_ANSWER_CHARS} characters, a few sentences.`}
          />
          <Button
            label={feedback ? 'Mark it again' : 'Mark my answer'}
            icon={{ ios: 'sparkles', android: 'auto_awesome' }}
            busy={busy}
            disabled={!canScore(answer)}
            onPress={() => void mark()}
          />
          <Note text={error} tone="error" />
          {feedback ? <FeedbackView feedback={feedback} /> : null}
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
  },
  question: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
  meta: {
    fontSize: 14,
    lineHeight: 20,
  },
  tip: {
    borderRadius: 12,
    padding: Spacing.three,
    gap: 4,
  },
  feedback: {
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  verdict: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
  },
});
