import { useFocusEffect } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Field, Note, Picker, Points, ScoreBadge } from '@/components/ai-tool';
import { LoadState } from '@/components/load-state';
import { Text } from '@/components/text';
import { Button, Card, Group, Kicker, Row, Screen, Segmented, SectionHeader, Title } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useLoad } from '@/hooks/use-load';
import { usePalette } from '@/hooks/use-palette';
import { useRun } from '@/hooks/use-run';
import { scoreTone } from '@/lib/ai-tools';
import { askStudyCoach, getStudyCoach, markStudyEssay, type ChatTurn, type EssayMark } from '@/lib/site-api';
import { hideSplash } from '@/lib/splash';

type Mode = 'tutor' | 'mark';

/** The Study Coach: a tutor for your exam board, and an examiner for your essays. */
export default function StudyCoachScreen() {
  const palette = usePalette();
  const { data, error, missing, refreshing, refresh, reload } = useLoad(getStudyCoach);
  const [mode, setMode] = useState<Mode>('tutor');
  const [level, setLevel] = useState('a_level');
  const [subject, setSubject] = useState('Economics');
  const [board, setBoard] = useState('AQA');
  const [chat, setChat] = useState<ChatTurn[]>([]);
  const [message, setMessage] = useState('');
  const [question, setQuestion] = useState('');
  const [marks, setMarks] = useState('25');
  const [essay, setEssay] = useState('');
  const [result, setResult] = useState<EssayMark | null>(null);
  const tutor = useRun();
  const marker = useRun();

  useFocusEffect(hideSplash);

  const context = { level, subject, board };

  async function send() {
    const asked = message.trim();
    const turns: ChatTurn[] = [...chat, { role: 'user', content: asked }];
    setChat(turns);
    setMessage('');
    const answer = await tutor.run(() => askStudyCoach(context, turns));
    if (answer) {
      setChat([...turns, { role: 'tutor', content: answer.reply }]);
    } else {
      // Put the question back so it can be sent again.
      setChat(chat);
      setMessage(asked);
    }
  }

  async function mark() {
    const marked = await marker.run(() => markStudyEssay({ ...context, question, totalMarks: Number(marks) || 0, essay }));
    if (marked) {
      setResult(marked);
      void reload();
    }
  }

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Title eyebrow="AI tools" title="Study coach" />
      <LoadState loaded={!!data} error={error} missing={missing} retry={refresh} web={{ path: '/study-coach', title: 'Study coach' }} />

      {data ? (
        <>
          <Card style={styles.card}>
            <Picker label="Level" options={data.levels} value={level} onChange={setLevel} />
            <Picker label="Subject" options={data.subjects.map((s) => ({ key: s, label: s }))} value={subject} onChange={setSubject} />
            <Picker label="Exam board" options={data.boards.map((b) => ({ key: b, label: b }))} value={board} onChange={setBoard} />
          </Card>

          <Segmented
            options={[
              ['tutor', 'Ask the tutor'],
              ['mark', 'Mark my essay'],
            ]}
            value={mode}
            onChange={setMode}
          />

          {mode === 'tutor' ? (
            <>
              {chat.map((turn, i) => (
                <View
                  key={i}
                  style={[
                    styles.bubble,
                    turn.role === 'user'
                      ? [styles.mine, { backgroundColor: palette.tint }]
                      : [styles.theirs, { backgroundColor: palette.surface, borderColor: palette.hair }],
                  ]}>
                  <Text selectable style={[styles.bubbleText, { color: turn.role === 'user' ? '#FFFFFF' : palette.text }]}>
                    {turn.content}
                  </Text>
                </View>
              ))}
              {tutor.busy ? <Note text="The tutor is thinking..." /> : null}
              <Note text={tutor.error} tone="error" />
              <Card style={styles.card}>
                <Field
                  label={chat.length ? 'Reply' : `Ask anything on ${board} ${subject}`}
                  multiline
                  minHeight={80}
                  placeholder="e.g. How do I evaluate in a 25-marker?"
                  value={message}
                  onChangeText={setMessage}
                />
                <Button label="Send" icon={{ ios: 'paperplane.fill', android: 'send' }} busy={tutor.busy} disabled={!message.trim()} onPress={() => void send()} />
                {chat.length ? <Button variant="secondary" label="New conversation" onPress={() => setChat([])} /> : null}
              </Card>
            </>
          ) : (
            <>
              <Card style={styles.card}>
                <Field label="Exam question" multiline minHeight={80} value={question} onChangeText={setQuestion} />
                <Field label="Marks" keyboardType="number-pad" value={marks} onChangeText={setMarks} />
                <Field label="Your answer" multiline minHeight={220} value={essay} onChangeText={setEssay} />
                <Button
                  label="Mark it like an examiner"
                  icon={{ ios: 'sparkles', android: 'auto_awesome' }}
                  busy={marker.busy}
                  disabled={question.trim().length < 10 || essay.trim().length < 80}
                  onPress={() => void mark()}
                />
                <Note text={marker.error} tone="error" />
              </Card>

              {result ? (
                <>
                  <Card style={styles.card}>
                    <View style={styles.head}>
                      <ScoreBadge score={result.awardedMarks} outOf={result.totalMarks} caption={result.band} />
                      <Text style={[styles.body, styles.flex, { color: palette.text }]}>{result.examinerSummary}</Text>
                    </View>
                    {result.aoScores.map((ao) => (
                      <View key={ao.name} style={styles.ao}>
                        <Text style={[styles.aoName, { color: palette.text }]}>{`${ao.name} · ${ao.score}/${ao.outOf}`}</Text>
                        <Text style={[styles.body, { color: palette.textSecondary }]}>{ao.comment}</Text>
                      </View>
                    ))}
                  </Card>
                  <Points title="Strengths" points={result.strengths} tone="green" />
                  <Points title="Marks to gain" points={result.improvements} tone="amber" />
                </>
              ) : null}
            </>
          )}

          {data.progress.weakTopics.length ? (
            <>
              <SectionHeader title="Topics to work on" icon={{ ios: 'target', android: 'track_changes' }} />
              <Group>
                {data.progress.weakTopics.slice(0, 6).map((topic) => (
                  <Row
                    key={`${topic.subject}-${topic.topic}`}
                    icon={{ ios: 'book.fill', android: 'menu_book' }}
                    title={topic.topic}
                    subtitle={`${topic.subject} · ${topic.attempts} marked`}
                    pill={{ label: `${topic.averagePercent}%`, tone: scoreTone(topic.averagePercent, 100) }}
                  />
                ))}
              </Group>
            </>
          ) : null}
          <Kicker>Answers are coached, never written for you.</Kicker>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    maxWidth: '88%',
  },
  mine: {
    alignSelf: 'flex-end',
  },
  theirs: {
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 22,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  flex: {
    flex: 1,
  },
  ao: {
    gap: 2,
  },
  aoName: {
    fontSize: 14,
    fontWeight: '700',
  },
});
