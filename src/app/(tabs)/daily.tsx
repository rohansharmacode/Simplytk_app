import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { StreakStrip } from '@/components/streak-strip';
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
        kicker={daily ? `Daily #${daily.number}` : 'Daily challenge'}
        title={`${daily?.total ?? 20} questions.`}
        subtitle="Same set for everyone, every day."
      />

      {!loaded ? <Loading /> : null}

      {missing ? (
        <Empty
          title="Play today’s challenge on the website"
          body="The app version goes live with the next simplytk.com update. Your score counts the same either way."
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
    fontSize: 48,
    lineHeight: 52,
    fontWeight: '600',
    letterSpacing: -1.8,
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
