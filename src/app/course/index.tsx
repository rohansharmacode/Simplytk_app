import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LoadState } from '@/components/load-state';
import { Text } from '@/components/text';
import { Card, Chip, Hero, HeroStats, Kicker, onHero, Screen, SectionHeader, Title } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useLoad } from '@/hooks/use-load';
import { usePalette } from '@/hooks/use-palette';
import { bandsByQuestion } from '@/lib/course';
import { getCourse } from '@/lib/site-api';
import { hideSplash } from '@/lib/splash';

/** The interview course: a track per career, modules with questions an AI tutor marks. */
export default function CourseScreen() {
  const palette = usePalette();
  const router = useRouter();
  const params = useLocalSearchParams<{ track?: string }>();
  const { data, error, missing, refreshing, refresh, reload } = useLoad(getCourse);
  const [trackId, setTrackId] = useState<string | null>(params.track ?? null);

  useFocusEffect(
    useCallback(() => {
      hideSplash();
      void reload();
    }, [reload]),
  );

  const track = data?.tracks.find((t) => t.id === trackId) ?? data?.tracks[0];
  const bands = useMemo(() => bandsByQuestion(data?.progress ?? []), [data]);
  const answered = bands.size;
  const ready = [...bands.values()].filter((band) => band >= 5).length;
  const questions = data?.tracks.reduce((sum, t) => sum + t.modules.reduce((n, m) => n + m.questionCount, 0), 0) ?? 0;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Title eyebrow="Practice" title="Interview course" />

      <Hero>
        <Kicker color={onHero.secondary}>Answer, get marked, try again</Kicker>
        <Text style={styles.heroBody}>
          Each module explains what interviewers test, then gives you real questions. The AI tutor marks your answer
          from 1 to 5 and nudges you without giving it away.
        </Text>
        <HeroStats
          stats={[
            { value: data ? String(answered) : '–', label: 'Answered' },
            { value: data ? String(ready) : '–', label: 'Interview-ready' },
            { value: data ? String(questions) : '–', label: 'Questions' },
          ]}
        />
      </Hero>

      <LoadState
        loaded={!!data}
        error={error}
        missing={missing}
        retry={refresh}
        web={{ path: '/interview-course', title: 'Interview course' }}
      />

      {data && track ? (
        <>
          <View style={styles.chips}>
            {data.tracks.map((option) => (
              <Chip key={option.id} label={option.label} selected={option.id === track.id} onPress={() => setTrackId(option.id)} />
            ))}
          </View>
          <Text style={[styles.body, { color: palette.textSecondary }]}>{track.description}</Text>

          <SectionHeader title="Modules" icon={{ ios: 'books.vertical.fill', android: 'school' }} count={track.modules.length} />
          {track.modules.map((module, index) => (
            <Card
              key={module.id}
              accessibilityLabel={module.title}
              onPress={() => router.push({ pathname: '/course/[module]', params: { module: module.id } })}
              style={styles.card}>
              <Kicker>{`Module ${index + 1} · ${module.questionCount} questions`}</Kicker>
              <Text style={[styles.moduleTitle, { color: palette.text }]}>{module.title}</Text>
              {module.objectives.slice(0, 3).map((objective) => (
                <Text key={objective} style={[styles.objective, { color: palette.textSecondary }]} numberOfLines={2}>
                  {`• ${objective}`}
                </Text>
              ))}
            </Card>
          ))}
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    gap: Spacing.one,
  },
  moduleTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  objective: {
    fontSize: 14,
    lineHeight: 19,
  },
});
