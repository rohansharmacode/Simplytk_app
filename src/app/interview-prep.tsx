import { useFocusEffect } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Field, Note, Picker } from '@/components/ai-tool';
import { LoadState } from '@/components/load-state';
import { Text } from '@/components/text';
import { AnswerCard } from '@/components/tools/answer-card';
import { Button, Card, Hero, Kicker, onHero, Screen, SectionHeader, Title } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useLoad } from '@/hooks/use-load';
import { usePalette } from '@/hooks/use-palette';
import { useRun } from '@/hooks/use-run';
import { getInterviewPrep, prepQuestions, type PrepQuestion } from '@/lib/site-api';
import { hideSplash } from '@/lib/splash';
import { openSitePath } from '@/lib/web-pages';

/** Firm prep: the questions a firm asks, answered and marked like a real interviewer would. */
export default function InterviewPrepScreen() {
  const palette = usePalette();
  const { data, error, missing, refreshing, refresh } = useLoad(getInterviewPrep);
  const [company, setCompany] = useState('');
  const [programme, setProgramme] = useState('spring_week');
  const [sector, setSector] = useState('investment_banking');
  const [questions, setQuestions] = useState<{ company: string; list: PrepQuestion[] } | null>(null);
  const { run, busy, error: runError } = useRun();

  useFocusEffect(hideSplash);

  async function generate() {
    const firm = company.trim();
    const list = await run(() => prepQuestions(firm, programme, sector));
    if (list) setQuestions({ company: firm, list });
  }

  const bank = data?.bank[sector] ?? [];

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Title eyebrow="AI tools" title="Firm prep" />
      <Hero>
        <Kicker color={onHero.secondary}>The rehearsal room</Kicker>
        <Text style={styles.heroBody}>
          Pick the firm you applied to and practise the fit, behavioural and HireVue-style questions it asks. Each answer
          is marked out of 10 with what to fix.
        </Text>
        <Button variant="onHero" label="Rehearse the recorded round" onPress={() => openSitePath('/mock-interview', 'Mock interview')} />
      </Hero>

      <LoadState loaded={!!data} error={error} missing={missing} retry={refresh} web={{ path: '/interview-prep', title: 'Firm prep' }} />

      {data ? (
        <>
          <Card style={styles.card}>
            <Field label="Firm" placeholder="e.g. Goldman Sachs" value={company} onChangeText={setCompany} />
            <Picker label="Programme" options={data.programmes} value={programme} onChange={setProgramme} />
            <Picker label="Sector" options={data.sectors} value={sector} onChange={setSector} />
            <Button
              label="Get my questions"
              icon={{ ios: 'sparkles', android: 'auto_awesome' }}
              busy={busy}
              disabled={company.trim().length < 2}
              onPress={() => void generate()}
            />
            <Note text={runError} tone="error" />
          </Card>

          {questions ? (
            <>
              <SectionHeader title={`Questions for ${questions.company}`} icon={{ ios: 'building.columns.fill', android: 'account_balance' }} />
              {questions.list.map((q, i) => (
                <AnswerCard
                  key={`${questions.company}-${q.question}`}
                  index={i + 1}
                  question={q.question}
                  whatTheyTest={q.whatTheyTest}
                  tip={q.tip}
                  company={questions.company}
                />
              ))}
            </>
          ) : null}

          {bank.length ? (
            <>
              <SectionHeader title="Question bank" icon={{ ios: 'tray.full.fill', android: 'inventory_2' }} count={bank.length} />
              <Text style={[styles.body, { color: palette.textSecondary }]}>
                The fit and behavioural questions UK firms actually ask in this sector. Tap one to answer it.
              </Text>
              <View style={styles.list}>
                {bank.map((q, i) => (
                  <AnswerCard
                    key={`${sector}-${q.question}`}
                    index={i + 1}
                    question={q.question}
                    whatTheyTest={q.whatTheyTest}
                    tip={q.tip}
                    company={company.trim() || 'the firm'}
                  />
                ))}
              </View>
            </>
          ) : null}
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
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
  list: {
    gap: Spacing.three,
  },
});
