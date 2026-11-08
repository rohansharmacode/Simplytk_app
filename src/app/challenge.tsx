import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import { NumberPad, type PadKey } from '@/components/number-pad';
import { Text } from '@/components/text';
import { Button, Card, Kicker, Loading } from '@/components/ui';
import { Radius, Spacing, Tabular } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import {
  answerText,
  applyKey,
  createRecorder,
  formatDuration,
  inputModeFor,
  isCorrect,
  promptFor,
  SKIP,
} from '@/lib/daily/answers';
import { refreshDaily } from '@/lib/daily/store';
import { hapticCorrect, hapticFinished, hapticWrong } from '@/lib/haptics';
import {
  getDaily,
  SiteApiMissing,
  submitDaily,
  type AnswerEvent,
  type DailyProblem,
  type DailyResult,
} from '@/lib/site-api';

/** How long the right/wrong flash shows before the next question. */
const FEEDBACK_MS = 280;

type Phase =
  | { kind: 'loading' }
  | { kind: 'unavailable'; reason: string; web: boolean }
  | { kind: 'playing'; sessionId: string; problems: DailyProblem[]; number: number }
  | { kind: 'submitting'; problems: DailyProblem[] }
  | { kind: 'done'; result: DailyResult; problems: DailyProblem[]; number: number };

/**
 * Today's daily challenge, full screen: the same questions as simplytk.com/daily, a clock
 * counting up, and the score posted to the same leaderboard. The site marks the run.
 */
export default function ChallengeScreen() {
  const palette = usePalette();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });

  useEffect(() => {
    let live = true;
    getDaily()
      .then((state) => {
        if (!live) return;
        if (state.result) {
          setPhase({ kind: 'done', result: state.result, problems: state.problems ?? [], number: state.number });
        } else if (state.sessionId && state.problems?.length) {
          setPhase({ kind: 'playing', sessionId: state.sessionId, problems: state.problems, number: state.number });
        } else {
          setPhase({ kind: 'unavailable', reason: 'Today’s challenge is not ready yet. Try again in a minute.', web: false });
        }
      })
      .catch((error) => {
        if (!live) return;
        setPhase({
          kind: 'unavailable',
          web: error instanceof SiteApiMissing,
          reason:
            error instanceof SiteApiMissing
              ? 'The app can’t load the daily challenge right now. You can play it on the website instead.'
              : error instanceof Error
                ? error.message
                : String(error),
        });
      });
    return () => {
      live = false;
    };
  }, []);

  async function finish(sessionId: string, problems: DailyProblem[], number: number, events: AnswerEvent[]) {
    setPhase({ kind: 'submitting', problems });
    try {
      const result = await submitDaily(sessionId, events);
      hapticFinished();
      setPhase({ kind: 'done', result, problems, number });
      void refreshDaily();
    } catch (error) {
      setPhase({
        kind: 'unavailable',
        web: false,
        reason: `Your run could not be saved: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
      {phase.kind === 'playing' ? (
        <Run
          problems={phase.problems}
          number={phase.number}
          onFinish={(events) => void finish(phase.sessionId, phase.problems, phase.number, events)}
        />
      ) : (
        <View style={styles.page}>
          <CloseButton onPress={() => router.back()} />
          {phase.kind === 'loading' || phase.kind === 'submitting' ? <Loading /> : null}
          {phase.kind === 'unavailable' ? (
            <View style={styles.message}>
              <Text style={[styles.messageText, { color: palette.text }]}>{phase.reason}</Text>
              {phase.web ? (
                <Button
                  label="Play on simplytk.com"
                  onPress={() => {
                    router.back();
                    router.push({ pathname: '/page', params: { path: '/daily', title: 'Daily challenge' } });
                  }}
                />
              ) : null}
            </View>
          ) : null}
          {phase.kind === 'done' ? <Finished result={phase.result} problems={phase.problems} number={phase.number} /> : null}
        </View>
      )}
    </SafeAreaView>
  );
}

function CloseButton({ onPress }: { onPress: () => void }) {
  const palette = usePalette();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={12} onPress={onPress} style={styles.close}>
      <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} tintColor={palette.textSecondary} size={20} />
    </Pressable>
  );
}

function Run({
  problems,
  number,
  onFinish,
}: {
  problems: DailyProblem[];
  number: number;
  onFinish: (events: AnswerEvent[]) => void;
}) {
  const palette = usePalette();
  const [startedAt] = useState(() => Date.now());
  const recorder = useRef(createRecorder(startedAt)).current;
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState('');
  const [flash, setFlash] = useState<'c' | 'w' | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setElapsed(Date.now() - startedAt), 250);
    return () => clearInterval(timer);
  }, [startedAt]);

  const problem = problems[index];
  const mode = inputModeFor(problem);
  const prompt = promptFor(problem);

  function answer(given: string) {
    if (flash) return;
    recorder.record(given);
    const right = given !== SKIP && isCorrect(problem, given);
    if (given !== SKIP) {
      if (right) hapticCorrect();
      else hapticWrong();
    }
    setFlash(given === SKIP ? null : right ? 'c' : 'w');
    setTimeout(
      () => {
        setFlash(null);
        setValue('');
        if (index + 1 >= problems.length) onFinish(recorder.events);
        else setIndex(index + 1);
      },
      given === SKIP ? 0 : FEEDBACK_MS,
    );
  }

  function leave() {
    Alert.alert('Leave the challenge?', 'Your answers so far are not saved. You can start again from the first question.', [
      { text: 'Keep going', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => router.back() },
    ]);
  }

  const flashColor = flash === 'c' ? palette.success : flash === 'w' ? palette.danger : palette.hair;

  return (
    <View style={styles.run}>
      <View style={styles.bar}>
        <CloseButton onPress={leave} />
        <Text style={[styles.counter, Tabular, { color: palette.textSecondary }]}>
          {index + 1}/{problems.length}
        </Text>
        <Text style={[styles.clock, Tabular, { color: palette.text }]}>{formatDuration(elapsed)}</Text>
      </View>
      <View style={[styles.progress, { backgroundColor: palette.raised }]}>
        <View style={[styles.progressFill, { backgroundColor: palette.tint, width: `${(index / problems.length) * 100}%` }]} />
      </View>

      <View style={styles.question}>
        <Kicker>{`Daily #${number} · ${prompt.kicker}`}</Kicker>
        <Text style={[styles.prompt, mode.kind === 'choice' && styles.promptLong, { color: palette.text }]}>{prompt.text}</Text>
      </View>

      {mode.kind === 'number' ? (
        <View style={styles.answerArea}>
          <View style={[styles.answerBox, { backgroundColor: palette.surface, borderColor: flashColor }]}>
            <Text
              accessibilityLabel="Your answer"
              style={[styles.answerText, Tabular, { color: value ? palette.text : palette.faint }]}>
              {value || ' '}
            </Text>
          </View>
          <NumberPad
            fraction={mode.fraction}
            canSubmit={value !== '' && value !== '-' && !flash}
            onKey={(key: PadKey) => setValue((v) => applyKey(v, key, mode.fraction))}
            onEnter={() => answer(value)}
          />
          <Pressable accessibilityRole="button" onPress={() => answer(SKIP)} style={styles.skip} hitSlop={8}>
            <Text style={[styles.skipText, { color: palette.textSecondary }]}>Skip</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.options}>
          {mode.options.map((option) => (
            <Pressable
              key={option}
              accessibilityRole="button"
              onPressIn={() => answer(option)}
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor: pressed ? palette.raised : palette.surface,
                  borderColor: flash && option === answerText(problem) ? palette.success : palette.hair,
                },
              ]}>
              <Text style={[styles.optionText, { color: palette.text }]}>{option}</Text>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" onPress={() => answer(SKIP)} style={styles.skip} hitSlop={8}>
            <Text style={[styles.skipText, { color: palette.textSecondary }]}>Skip</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

function Finished({ result, problems, number }: { result: DailyResult; problems: DailyProblem[]; number: number }) {
  const palette = usePalette();
  return (
    <ScrollView contentContainerStyle={styles.finished}>
      <Kicker>{`Daily #${number} · done`}</Kicker>
      <Text style={[styles.score, Tabular, { color: palette.text }]}>
        {result.score}/{result.total}
      </Text>
      <Text style={[styles.messageText, Tabular, { color: palette.textSecondary }]}>
        in {formatDuration(result.durationMs)}. Your score is on today’s leaderboard.
      </Text>
      <View style={styles.strip} accessibilityLabel={`${result.score} right out of ${result.total}`}>
        {result.detail.map((mark, i) => (
          <View
            key={i}
            style={[
              styles.cell,
              { backgroundColor: mark === 'c' ? palette.success : mark === 'w' ? palette.danger : palette.raised },
            ]}
          />
        ))}
      </View>
      <View style={styles.finishedActions}>
        <Button label="See the leaderboard" onPress={() => router.replace('/ranks')} />
        <Button variant="secondary" label="Done" onPress={() => router.back()} />
      </View>
      {problems.length ? (
        <View style={styles.review}>
          {problems.map((problem, i) => {
            const prompt = promptFor(problem);
            const mark = result.detail[i];
            return (
              <Card key={i} style={styles.reviewCard}>
                <Text style={[styles.reviewKicker, { color: mark === 'c' ? palette.success : mark === 'w' ? palette.danger : palette.faint }]}>
                  {`${i + 1}. ${mark === 'c' ? 'Right' : mark === 'w' ? 'Wrong' : 'Skipped'}`}
                </Text>
                <Text style={[styles.reviewPrompt, { color: palette.text }]}>{prompt.text}</Text>
                <Text style={[styles.reviewAnswer, { color: palette.textSecondary }]}>Answer: {answerText(problem)}</Text>
              </Card>
            );
          })}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    padding: Spacing.four,
  },
  close: {
    padding: Spacing.two,
    alignSelf: 'flex-start',
  },
  message: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.five,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 23,
  },
  run: {
    flex: 1,
    padding: Spacing.four,
    gap: Spacing.four,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  counter: {
    fontSize: 15,
    fontWeight: '500',
  },
  clock: {
    fontSize: 20,
    fontWeight: '600',
    minWidth: 56,
    textAlign: 'right',
  },
  progress: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
  },
  question: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.three,
  },
  prompt: {
    fontSize: 34,
    lineHeight: 42,
    fontWeight: '600',
    letterSpacing: -0.8,
  },
  promptLong: {
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  answerArea: {
    gap: Spacing.three,
  },
  answerBox: {
    minHeight: 64,
    borderRadius: Radius.small,
    borderWidth: 2,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  answerText: {
    fontSize: 32,
    fontWeight: '600',
    textAlign: 'right',
  },
  skip: {
    alignSelf: 'center',
    padding: Spacing.two,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '500',
  },
  options: {
    gap: Spacing.two,
    paddingBottom: Spacing.four,
  },
  option: {
    minHeight: 54,
    borderRadius: Radius.small,
    borderWidth: 2,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    justifyContent: 'center',
  },
  optionText: {
    fontSize: 17,
    lineHeight: 23,
  },
  finished: {
    paddingVertical: Spacing.four,
    gap: Spacing.three,
  },
  score: {
    fontSize: 64,
    lineHeight: 70,
    fontWeight: '600',
    letterSpacing: -2.5,
  },
  strip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  cell: {
    width: 14,
    height: 14,
    borderRadius: 4,
  },
  finishedActions: {
    gap: Spacing.three,
    marginTop: Spacing.three,
  },
  review: {
    gap: Spacing.two,
    marginTop: Spacing.four,
  },
  reviewCard: {
    gap: Spacing.one,
    paddingVertical: 14,
  },
  reviewKicker: {
    fontSize: 13,
    fontWeight: '600',
  },
  reviewPrompt: {
    fontSize: 15,
    lineHeight: 21,
  },
  reviewAnswer: {
    fontSize: 14,
  },
});
