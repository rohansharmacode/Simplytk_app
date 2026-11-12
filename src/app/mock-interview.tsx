import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Field, Note, Picker, ScoreBadge } from '@/components/ai-tool';
import { LoadState } from '@/components/load-state';
import { Text } from '@/components/text';
import { FeedbackView } from '@/components/tools/answer-card';
import { Button, Card, Group, Hero, HeroStats, Kicker, onHero, Row, Screen, SectionHeader, Title } from '@/components/ui';
import { Spacing, Tabular } from '@/constants/theme';
import { useLoad } from '@/hooks/use-load';
import { usePalette } from '@/hooks/use-palette';
import { useRun } from '@/hooks/use-run';
import { averageScore, canScore, formatClock, MOCK_ANSWER_SECONDS, scoreTone } from '@/lib/ai-tools';
import {
  followUp,
  getInterviewPrep,
  getMockInterviews,
  prepQuestions,
  saveMockInterview,
  scoreAnswer,
  type AnswerFeedback,
  type FollowUp,
  type MockRound,
  type PrepQuestion,
} from '@/lib/site-api';
import { hideSplash } from '@/lib/splash';

type Setup = { company: string; programme: string; sector: string };

async function loadSetup() {
  const [prep, history] = await Promise.all([getInterviewPrep(), getMockInterviews()]);
  return { prep, history };
}

/** Counts up while `running`, from zero each time `key` changes. */
function useStopwatch(running: boolean, key: string) {
  const [state, setState] = useState({ key, seconds: 0 });
  if (state.key !== key) setState({ key, seconds: 0 });
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setState((s) => ({ ...s, seconds: s.seconds + 1 })), 1000);
    return () => clearInterval(timer);
  }, [running, key]);
  return state.key === key ? state.seconds : 0;
}

/**
 * The mock interview: five questions against the clock, each marked, with the follow-up a
 * sharp interviewer would ask next. Answers are typed or dictated with the keyboard's mic.
 */
export default function MockInterviewScreen() {
  const palette = usePalette();
  const { data, error, missing, refreshing, refresh, reload } = useLoad(loadSetup);
  const [setup, setSetup] = useState<Setup>({ company: '', programme: 'spring_week', sector: 'investment_banking' });
  const [questions, setQuestions] = useState<PrepQuestion[] | null>(null);
  const [rounds, setRounds] = useState<MockRound[]>([]);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [probe, setProbe] = useState<FollowUp | null>(null);
  const [probeAnswer, setProbeAnswer] = useState('');
  const [probeFeedback, setProbeFeedback] = useState<AnswerFeedback | null>(null);
  const [saved, setSaved] = useState<boolean | null>(null);
  const { run, busy, error: runError } = useRun();

  useFocusEffect(hideSplash);

  const index = rounds.length;
  const current = questions?.[index] ?? null;
  const finished = !!questions && index >= questions.length;
  const seconds = useStopwatch(!!current && !feedback, `${index}`);
  const left = MOCK_ANSWER_SECONDS - seconds;

  async function start() {
    const company = setup.company.trim();
    const list = await run(() => prepQuestions(company, setup.programme, setup.sector));
    if (!list) return;
    setSetup((s) => ({ ...s, company }));
    setQuestions(list);
    setRounds([]);
    setSaved(null);
  }

  async function submit() {
    if (!current) return;
    const result = await run(() =>
      Promise.all([
        scoreAnswer(setup.company, current.question, answer),
        followUp(setup.company, current.question, answer).catch(() => null),
      ]),
    );
    if (!result) return;
    setFeedback(result[0]);
    setProbe(result[1]);
  }

  async function submitProbe() {
    if (!probe) return;
    const result = await run(() => scoreAnswer(setup.company, probe.question, probeAnswer));
    if (result) setProbeFeedback(result);
  }

  const next = useCallback(() => {
    if (!current || !feedback) return;
    const round: MockRound = {
      question: current.question,
      whatTheyTest: current.whatTheyTest,
      transcript: answer,
      seconds,
      score: feedback.score,
      verdict: feedback.verdict,
      feedback: feedback.feedback,
      delivery: null,
      followUp: probe
        ? {
            question: probe.question,
            transcript: probeAnswer,
            score: probeFeedback?.score ?? null,
            verdict: probeFeedback?.verdict ?? null,
          }
        : null,
    };
    setRounds((list) => [...list, round]);
    setAnswer('');
    setFeedback(null);
    setProbe(null);
    setProbeAnswer('');
    setProbeFeedback(null);
  }, [answer, current, feedback, probe, probeAnswer, probeFeedback, seconds]);

  async function save() {
    const result = await run(() => saveMockInterview({ ...setup, rounds }));
    if (result) {
      setSaved(result.saved);
      if (result.saved) void reload();
    }
  }

  function reset() {
    setQuestions(null);
    setRounds([]);
    setSaved(null);
  }

  const average = averageScore(rounds);

  return (
    <Screen refreshing={!questions && refreshing} onRefresh={questions ? undefined : refresh}>
      <Title eyebrow="AI tools" title="Mock interview" />

      <LoadState loaded={!!data} error={error} missing={missing} retry={refresh} web={{ path: '/mock-interview', title: 'Mock interview' }} />

      {data && !questions ? (
        <>
          <Hero>
            <Kicker color={onHero.secondary}>The recorded round, rehearsed</Kicker>
            <Text style={styles.heroBody}>
              {`Five questions, ${formatClock(MOCK_ANSWER_SECONDS)} each, like a HireVue. After each answer you get a mark out of 10 and the follow-up an interviewer would ask.`}
            </Text>
          </Hero>
          <Card style={styles.card}>
            <Field label="Firm" placeholder="e.g. J.P. Morgan" value={setup.company} onChangeText={(company) => setSetup((s) => ({ ...s, company }))} />
            <Picker label="Programme" options={data.prep.programmes} value={setup.programme} onChange={(programme) => setSetup((s) => ({ ...s, programme }))} />
            <Picker label="Sector" options={data.prep.sectors} value={setup.sector} onChange={(sector) => setSetup((s) => ({ ...s, sector }))} />
            <Button
              label="Start the interview"
              icon={{ ios: 'play.fill', android: 'play_arrow' }}
              busy={busy}
              disabled={setup.company.trim().length < 2}
              onPress={() => void start()}
            />
            <Note text={runError} tone="error" />
          </Card>

          {data.history.sessions.length ? (
            <>
              <SectionHeader title="Past interviews" icon={{ ios: 'clock.arrow.circlepath', android: 'history' }} count={data.history.sessions.length} />
              <Group>
                {data.history.sessions.map((session) => (
                  <Row
                    key={session.id}
                    icon={{ ios: 'video.fill', android: 'videocam' }}
                    title={session.company ?? 'Mock interview'}
                    subtitle={`${new Date(session.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · ${session.rounds.length} questions`}
                    pill={
                      session.averageScore != null
                        ? { label: `${session.averageScore}/10`, tone: scoreTone(session.averageScore) }
                        : undefined
                    }
                  />
                ))}
              </Group>
            </>
          ) : null}
        </>
      ) : null}

      {current ? (
        <>
          <View style={styles.progress}>
            <Text style={[styles.step, { color: palette.textSecondary }]}>{`Question ${index + 1} of ${questions?.length}`}</Text>
            <Text
              style={[styles.clock, Tabular, { color: left <= 15 ? palette.danger : palette.text }]}
              accessibilityLabel={`${Math.max(0, left)} seconds left`}>
              {left > 0 ? formatClock(left) : 'Time’s up'}
            </Text>
          </View>
          <Card style={styles.card}>
            <Text style={[styles.question, { color: palette.text }]}>{current.question}</Text>
            <Field
              label="Your answer"
              multiline
              minHeight={160}
              placeholder="Answer as you would on camera. Tap the keyboard's mic to speak it."
              value={answer}
              onChangeText={setAnswer}
            />
            {!feedback ? (
              <Button label="Submit answer" busy={busy} disabled={!canScore(answer)} onPress={() => void submit()} />
            ) : null}
            <Note text={runError} tone="error" />
          </Card>

          {feedback ? (
            <>
              <FeedbackView feedback={feedback} />
              {probe ? (
                <Card style={styles.card}>
                  <Kicker>Follow-up</Kicker>
                  <Text style={[styles.question, { color: palette.text }]}>{probe.question}</Text>
                  {probe.why ? <Text style={[styles.body, { color: palette.textSecondary }]}>{probe.why}</Text> : null}
                  {probeFeedback ? (
                    <FeedbackView feedback={probeFeedback} />
                  ) : (
                    <>
                      <Field label="Your follow-up answer" multiline value={probeAnswer} onChangeText={setProbeAnswer} />
                      <Button
                        variant="secondary"
                        label="Submit follow-up"
                        busy={busy}
                        disabled={!canScore(probeAnswer)}
                        onPress={() => void submitProbe()}
                      />
                    </>
                  )}
                </Card>
              ) : null}
              <Button
                label={index + 1 < (questions?.length ?? 0) ? 'Next question' : 'Finish the interview'}
                icon={{ ios: 'arrow.right', android: 'arrow_forward' }}
                onPress={next}
              />
            </>
          ) : null}
        </>
      ) : null}

      {finished ? (
        <>
          <Hero>
            <Kicker color={onHero.secondary}>{`Mock interview · ${setup.company}`}</Kicker>
            <HeroStats
              stats={[
                { value: average != null ? `${average}` : '–', label: 'Average /10' },
                { value: String(rounds.length), label: 'Questions' },
                { value: formatClock(rounds.reduce((sum, r) => sum + r.seconds, 0)), label: 'Speaking time' },
              ]}
            />
          </Hero>
          {rounds.map((round, i) => (
            <Card key={round.question} style={styles.card}>
              <View style={styles.summaryRow}>
                {round.score != null ? <ScoreBadge score={round.score} outOf={10} /> : null}
                <Text style={[styles.question, styles.flex, { color: palette.text }]}>{`${i + 1}. ${round.question}`}</Text>
              </View>
              {round.verdict ? <Text style={[styles.body, { color: palette.textSecondary }]}>{round.verdict}</Text> : null}
            </Card>
          ))}
          {saved === null ? (
            <Button label="Save to my history" busy={busy} onPress={() => void save()} />
          ) : (
            <Note text={saved ? 'Saved. It’s under Past interviews.' : 'This interview isn’t kept: it stays here until you leave.'} />
          )}
          <Note text={runError} tone="error" />
          <Button variant="secondary" label="Start another" onPress={reset} />
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
  progress: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  step: {
    fontSize: 14,
    fontWeight: '600',
  },
  clock: {
    fontSize: 22,
    fontWeight: '700',
  },
  question: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '600',
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  flex: {
    flex: 1,
  },
});
