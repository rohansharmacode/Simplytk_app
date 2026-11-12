import { useFocusEffect } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Field, Note, Points, ScoreBadge } from '@/components/ai-tool';
import { LoadState } from '@/components/load-state';
import { Text } from '@/components/text';
import { Button, Card, Hero, HeroStats, Kicker, onHero, Screen, SectionHeader, Title } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useLoad } from '@/hooks/use-load';
import { usePalette } from '@/hooks/use-palette';
import { useRun } from '@/hooks/use-run';
import { quotaLine, statementCount, tierNote } from '@/lib/ai-tools';
import { brainstormStatement, getPsBuilder, reviewStatement, saveStatement, type PsIdea, type PsReview } from '@/lib/site-api';
import { hideSplash } from '@/lib/splash';

/**
 * The personal statement builder: the three UCAS questions, saved as you go, reviewed by an
 * admissions tutor. The draft is the one the site keeps, so it carries over both ways.
 */
export default function PsBuilderScreen() {
  const palette = usePalette();
  const { data, error, missing, refreshing, refresh } = useLoad(getPsBuilder);
  const [form, setForm] = useState<{ course: string; universities: string; answers: string[] } | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [experiences, setExperiences] = useState('');
  const [ideas, setIdeas] = useState<PsIdea[] | null>(null);
  const [review, setReview] = useState<PsReview | null>(null);
  const saving = useRun();
  const reviewing = useRun();
  const thinking = useRun();

  useFocusEffect(hideSplash);

  // The saved draft fills the form once, when it first arrives.
  if (data && !form) {
    setForm({
      course: data.draft?.course ?? '',
      universities: data.draft?.universities ?? '',
      answers: data.questions.map((_, i) => data.draft?.answers[i] ?? ''),
    });
  }

  const update = (patch: Partial<NonNullable<typeof form>>) => setForm((current) => current && { ...current, ...patch });
  const setAnswer = (index: number, text: string) =>
    setForm((current) => current && { ...current, answers: current.answers.map((a, i) => (i === index ? text : a)) });

  async function save() {
    if (!form) return;
    const done = await saving.run(() => saveStatement(form));
    if (done) setSavedAt(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
  }

  async function check() {
    if (!form) return;
    void saveStatement(form).catch(() => {});
    const result = await reviewing.run(() => reviewStatement(form));
    if (result) setReview(result);
  }

  async function brainstorm() {
    if (!form) return;
    const result = await thinking.run(() => brainstormStatement(form.course, experiences));
    if (result) setIdeas(result);
  }

  const count = data && form ? statementCount(form.answers, data.totalLimit) : null;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Title eyebrow="AI tools" title="Personal statement" />
      <LoadState loaded={!!data} error={error} missing={missing} retry={refresh} web={{ path: '/ps-builder', title: 'Personal statement' }} />

      {data && form ? (
        <>
          <Hero>
            <Kicker color={onHero.secondary}>The three UCAS questions</Kicker>
            <Text style={styles.heroBody}>
              Write each answer here, then have an admissions tutor review the whole statement: what works, what repeats and
              how well it fits the course.
            </Text>
          </Hero>

          <Card style={styles.card}>
            <Field label="Course" placeholder="e.g. Economics" value={form.course} onChangeText={(course) => update({ course })} />
            <Field
              label="Universities (optional)"
              placeholder="e.g. LSE, UCL, Warwick"
              value={form.universities}
              onChangeText={(universities) => update({ universities })}
            />
          </Card>

          {data.questions.map((question, i) => (
            <Card key={question} style={styles.card}>
              <Kicker>{`Question ${i + 1}`}</Kicker>
              <Text style={[styles.question, { color: palette.text }]}>{question}</Text>
              <Field
                label="Your answer"
                multiline
                minHeight={180}
                value={form.answers[i]}
                onChangeText={(text) => setAnswer(i, text)}
                hint={`${form.answers[i].length} characters · aim for at least ${data.minPerAnswer}`}
              />
            </Card>
          ))}

          <View style={styles.counter}>
            <Text style={[styles.count, { color: count?.over ? palette.danger : palette.textSecondary }]}>{count?.text}</Text>
            {savedAt ? <Text style={[styles.count, { color: palette.textSecondary }]}>{`Saved ${savedAt}`}</Text> : null}
          </View>
          <Button variant="secondary" label="Save my draft" busy={saving.busy} onPress={() => void save()} />
          <Note text={saving.error} tone="error" />
          <Button
            label="Review my statement"
            icon={{ ios: 'sparkles', android: 'auto_awesome' }}
            busy={reviewing.busy}
            disabled={form.course.trim().length < 2 || form.answers.every((a) => a.trim().length < 100)}
            onPress={() => void check()}
          />
          <Note text={reviewing.error} tone="error" />
          <Note text={quotaLine(data.quota, 'review')} />

          {review ? (
            <>
              <Hero>
                <Kicker color={onHero.secondary}>Tutor’s review</Kicker>
                <HeroStats
                  stats={[
                    { value: `${review.overallScore}`, label: 'Overall /10' },
                    ...(review.cohesion ? [{ value: `${review.cohesion.score}`, label: 'Flows /10' }] : []),
                  ]}
                />
                <Text style={styles.heroBody}>{review.tutorSummary}</Text>
              </Hero>
              <Note text={tierNote(review.tier)} />
              {review.questionFeedback.map((feedback) => (
                <Card key={feedback.question} style={styles.card}>
                  <View style={styles.head}>
                    <Text style={[styles.question, styles.flex, { color: palette.text }]}>{`Question ${feedback.question}`}</Text>
                    <ScoreBadge score={feedback.score} outOf={10} />
                  </View>
                  <Text style={[styles.body, { color: palette.textSecondary }]}>{feedback.verdict}</Text>
                  <Points title="Working" points={feedback.strengths} tone="green" />
                  <Points title="To improve" points={feedback.improvements} tone="amber" />
                  <Points title="Clichés" points={feedback.cliches} tone="red" />
                </Card>
              ))}
              {review.cohesion ? <Points title={`How it reads as one: ${review.cohesion.verdict}`} points={review.cohesion.notes} /> : null}
              <Points title="Said more than once" points={review.repetition} tone="amber" />
              <Points title="Fit with the course" points={review.courseFit} />
              <Points title="Do next" points={review.nextActions} />
            </>
          ) : null}

          <SectionHeader title="Stuck for what to write?" icon={{ ios: 'lightbulb.fill', android: 'lightbulb' }} />
          <Card style={styles.card}>
            <Field
              label="Things you’ve done"
              multiline
              placeholder={'One per line, e.g.\nWork experience at a local accountancy firm\nRan the school economics society'}
              value={experiences}
              onChangeText={setExperiences}
            />
            <Button
              variant="secondary"
              label="Where does each one fit?"
              busy={thinking.busy}
              disabled={form.course.trim().length < 2 || experiences.trim().length < 30}
              onPress={() => void brainstorm()}
            />
            <Note text={thinking.error} tone="error" />
            {ideas?.map((idea) => (
              <View key={idea.experience} style={styles.idea}>
                <Text style={[styles.ideaTitle, { color: palette.text }]}>{`${idea.experience} · Question ${idea.question}`}</Text>
                <Text style={[styles.body, { color: palette.textSecondary }]}>{idea.angle}</Text>
              </View>
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroBody: {
    color: onHero.secondary,
    fontSize: 15,
    lineHeight: 21,
  },
  card: {
    gap: Spacing.three,
  },
  question: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
  counter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  count: {
    fontSize: 13,
    fontWeight: '600',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  flex: {
    flex: 1,
  },
  idea: {
    gap: 2,
  },
  ideaTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
});
