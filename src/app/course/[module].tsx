import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LoadState } from '@/components/load-state';
import { Text, TextInput } from '@/components/text';
import { Button, Card, Kicker, Pill, Screen, SectionHeader } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useLoad } from '@/hooks/use-load';
import { usePalette } from '@/hooks/use-palette';
import { bandLabel, bandsByQuestion, bandTone, canAsk, coursePathFor, DIFFICULTY_LABELS, moduleProgress } from '@/lib/course';
import { askTutor, getCourse, getCourseModule, revealSolution, type CourseModule, type TutorResult } from '@/lib/site-api';
import { hideSplash } from '@/lib/splash';
import { openSitePath } from '@/lib/web-pages';

async function loadModule(id: string) {
  const [module, course] = await Promise.all([getCourseModule(id), getCourse()]);
  return { module, progress: course.progress };
}

/** One course module: the explainer, then each question with its answer box and tutor. */
export default function CourseModuleScreen() {
  const palette = usePalette();
  const { module: moduleId } = useLocalSearchParams<{ module: string }>();
  const { data, error, missing, refreshing, refresh, setData } = useLoad(() => loadModule(moduleId), moduleId);
  const [open, setOpen] = useState<string | null>(null);

  useFocusEffect(hideSplash);

  const bands = useMemo(() => bandsByQuestion(data?.progress ?? []), [data]);
  const module: CourseModule | undefined = data?.module;
  const progress = module ? moduleProgress(module.questions.map((q) => q.id), bands) : null;

  const marked = useCallback(
    (questionId: string, band: number) =>
      setData((current) => current && { ...current, progress: [...current.progress, { questionId, band }] }),
    [setData],
  );

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Stack.Screen options={{ title: module?.title ?? 'Module' }} />
      <LoadState
        loaded={!!module}
        error={error}
        missing={missing}
        retry={refresh}
        web={{ path: '/interview-course', title: 'Interview course' }}
      />

      {module && progress ? (
        <>
          <View style={styles.head}>
            <Text style={[styles.title, { color: palette.text }]}>{module.title}</Text>
            <Text style={[styles.meta, { color: palette.textSecondary }]}>
              {`${progress.answered} of ${progress.total} answered · ${progress.ready} interview-ready`}
            </Text>
          </View>

          <Card style={styles.card}>
            <Kicker>What interviewers test</Kicker>
            <Text style={[styles.body, { color: palette.text }]}>{module.explainer}</Text>
            {module.objectives.length ? (
              <View style={styles.objectives}>
                {module.objectives.map((objective) => (
                  <Text key={objective} style={[styles.objective, { color: palette.textSecondary }]}>
                    {`• ${objective}`}
                  </Text>
                ))}
              </View>
            ) : null}
            {module.drills.length ? (
              <View style={styles.pills}>
                {module.drills.map((drill) => (
                  <Pill
                    key={`${drill.to}-${drill.practiceTopic ?? ''}`}
                    label={drill.label}
                    onPress={() => openSitePath(coursePathFor(drill), drill.label)}
                  />
                ))}
              </View>
            ) : null}
          </Card>

          <SectionHeader title="Questions" icon={{ ios: 'questionmark.bubble.fill', android: 'quiz' }} count={module.questions.length} />
          {module.questions.map((question, index) => (
            <QuestionCard
              key={question.id}
              index={index + 1}
              question={question}
              band={bands.get(question.id) ?? null}
              open={open === question.id}
              onToggle={() => setOpen((current) => (current === question.id ? null : question.id))}
              onMarked={(band) => marked(question.id, band)}
            />
          ))}
        </>
      ) : null}
    </Screen>
  );
}

function QuestionCard({
  index,
  question,
  band,
  open,
  onToggle,
  onMarked,
}: {
  index: number;
  question: CourseModule['questions'][number];
  band: number | null;
  open: boolean;
  onToggle: () => void;
  onMarked: (band: number) => void;
}) {
  const palette = usePalette();
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<TutorResult | null>(null);
  const [solution, setSolution] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const attempted = result !== null || band !== null;

  async function ask() {
    setAsking(true);
    setFailure(null);
    try {
      const marked = await askTutor(question.id, answer);
      setResult(marked);
      onMarked(marked.band);
    } catch (thrown) {
      setFailure(thrown instanceof Error ? thrown.message : String(thrown));
    } finally {
      setAsking(false);
    }
  }

  async function reveal() {
    setRevealing(true);
    setFailure(null);
    try {
      setSolution((await revealSolution(question.id, !attempted)).solution);
    } catch (thrown) {
      setFailure(thrown instanceof Error ? thrown.message : String(thrown));
    } finally {
      setRevealing(false);
    }
  }

  return (
    <Card accessibilityLabel={`Question ${index}`} onPress={open ? undefined : onToggle} style={styles.card}>
      <View style={styles.questionHead}>
        <Pill label={DIFFICULTY_LABELS[question.difficulty]} tone={question.difficulty === 'hard' ? 'red' : question.difficulty === 'medium' ? 'amber' : 'green'} />
        {band !== null ? <Pill label={bandLabel(band)} tone={bandTone(band)} /> : null}
      </View>
      <Text style={[styles.prompt, { color: palette.text }]} onPress={open ? onToggle : undefined}>
        {`${index}. ${question.prompt}`}
      </Text>

      {open ? (
        <>
          <TextInput
            accessibilityLabel={`Your answer to question ${index}`}
            placeholder="Talk through your reasoning like you would to an interviewer..."
            placeholderTextColor={palette.faint}
            multiline
            value={answer}
            onChangeText={setAnswer}
            style={[styles.answer, { color: palette.text, backgroundColor: palette.raised }]}
          />
          <Button label="Get AI feedback" icon={{ ios: 'sparkles', android: 'auto_awesome' }} busy={asking} disabled={!canAsk(answer)} onPress={() => void ask()} />
          {!solution ? (
            <Button
              variant="secondary"
              label={attempted ? 'Show solution' : 'Give up, show solution'}
              busy={revealing}
              onPress={() => void reveal()}
            />
          ) : null}
          {failure ? <Text style={[styles.body, { color: palette.danger }]}>{failure}</Text> : null}

          {result ? (
            <View style={[styles.feedback, { backgroundColor: palette.tintSoft }]}>
              <Text style={[styles.band, { color: palette.tint }]}>{`Band ${result.band}/5 · ${bandLabel(result.band)}`}</Text>
              <Text style={[styles.body, { color: palette.text }]}>{result.feedback}</Text>
              {result.socraticQuestion ? (
                <Text style={[styles.body, styles.strong, { color: palette.text }]}>{`Think about this: ${result.socraticQuestion}`}</Text>
              ) : null}
              {result.hint ? <Text style={[styles.body, { color: palette.textSecondary }]}>{`Hint: ${result.hint}`}</Text> : null}
            </View>
          ) : null}

          {solution ? (
            <View style={[styles.feedback, { backgroundColor: palette.raised }]}>
              <Text style={[styles.band, { color: palette.text }]}>Model answer</Text>
              <Text style={[styles.body, { color: palette.text }]}>{solution}</Text>
            </View>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: {
    gap: Spacing.one,
  },
  title: {
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  meta: {
    fontSize: 14,
  },
  card: {
    gap: Spacing.three,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
  strong: {
    fontWeight: '600',
  },
  objectives: {
    gap: 4,
  },
  objective: {
    fontSize: 14,
    lineHeight: 19,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  questionHead: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  prompt: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
  answer: {
    minHeight: 110,
    borderRadius: 12,
    padding: Spacing.three,
    fontSize: 16,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  feedback: {
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  band: {
    fontSize: 14,
    fontWeight: '700',
  },
});
