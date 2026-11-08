import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { StreakStrip } from '@/components/streak-strip';
import { Text } from '@/components/text';
import { Button, Card, Empty, Kicker, Loading, Screen, Stat, Title } from '@/components/ui';
import { Spacing, Tabular } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { formatDuration } from '@/lib/daily/answers';
import { refreshDaily, useDaily } from '@/lib/daily/store';
import { hideSplash } from '@/lib/splash';
import { openWebPage } from '@/lib/web-pages';

/** Today's challenge: start it, or see how it went, with the streak underneath. */
export default function DailyScreen() {
  const palette = usePalette();
  const { daily, streak, missing, error, loaded } = useDaily();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      hideSplash();
      void refreshDaily();
    }, []),
  );

  async function refresh() {
    setRefreshing(true);
    await refreshDaily();
    setRefreshing(false);
  }

  const result = daily?.result ?? null;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Title
        title="Daily Challenge"
        subtitle={`${daily ? `#${daily.number} · ` : ''}${daily?.total ?? 20} questions, the same set for everyone.`}
      />

      {!loaded ? <Loading /> : null}

      {missing ? (
        <Empty
          title="Play today’s challenge on the website"
          body="The app can’t load it right now. Your score counts the same on the website."
          action={<Button label="Open the daily challenge" onPress={() => openWebPage('/daily', 'Daily challenge')} />}
        />
      ) : null}

      {loaded && !missing ? (
        <Card style={styles.today}>
          {result ? (
            <>
              <Kicker color={palette.success}>Done for today</Kicker>
              <Text style={[styles.score, Tabular, { color: palette.text }]}>
                {result.score}/{result.total}
              </Text>
              <Text style={[styles.body, Tabular, { color: palette.textSecondary }]}>
                in {formatDuration(result.durationMs)}. A new set lands at midnight.
              </Text>
              <Button variant="secondary" label="Review my answers" onPress={() => router.push('/challenge')} />
            </>
          ) : (
            <>
              <Text style={[styles.body, { color: palette.textSecondary }]}>
                Sequences, mental maths, fractions and reasoning. Answer on the keypad; the clock runs until the last
                question.
              </Text>
              <Button label="Start today’s challenge" onPress={() => router.push('/challenge')} />
            </>
          )}
        </Card>
      ) : null}

      {streak ? (
        <Card>
          <View style={styles.streakRow}>
            <Stat value={String(streak.current)} label="day streak" />
            <Stat value={String(streak.best)} label="best" color={palette.textSecondary} />
            <Stat value={String(streak.freezesLeft)} label="freezes left" color={palette.textSecondary} />
          </View>
          <StreakStrip streak={streak} />
          {streak.atRisk ? (
            <Text style={[styles.body, { color: palette.warning }]}>Play today to keep your streak.</Text>
          ) : null}
        </Card>
      ) : null}

      {error ? <Text style={[styles.body, { color: palette.danger }]}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  today: {
    gap: Spacing.four,
  },
  score: {
    fontSize: 44,
    lineHeight: 50,
    fontWeight: '700',
    letterSpacing: -1.4,
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
  },
  streakRow: {
    flexDirection: 'row',
    gap: Spacing.six,
  },
});
