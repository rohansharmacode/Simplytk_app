import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet } from 'react-native';

import { StreakStrip } from '@/components/streak-strip';
import { Text } from '@/components/text';
import { Button, Card, Empty, Group, Hero, HeroStats, Kicker, Loading, onHero, Row, Screen, SectionHeader, Title } from '@/components/ui';
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
      <Title eyebrow={daily ? `Daily #${daily.number}` : 'Daily'} title="Daily Challenge" />

      {!loaded ? <Loading /> : null}

      {missing ? (
        <Empty
          title="Play today’s challenge on the website"
          body="The app can’t load it right now. Your score counts the same on the website."
          action={<Button label="Open the daily challenge" onPress={() => openWebPage('/daily', 'Daily challenge')} />}
        />
      ) : null}

      {loaded && !missing ? (
        <Hero>
          <Kicker color={onHero.secondary}>{result ? 'Done for today' : 'Today’s set'}</Kicker>
          {result ? (
            <>
              <Text style={[styles.heroScore, Tabular]}>
                {result.score}/{result.total}
                <Text style={styles.heroBody}>{`  in ${formatDuration(result.durationMs)}`}</Text>
              </Text>
              <Text style={styles.heroBody}>A new set lands at midnight.</Text>
              <Button variant="onHero" label="Review my answers" onPress={() => router.push('/challenge')} />
            </>
          ) : (
            <>
              <Text style={styles.heroTitle}>{daily?.total ?? 20} questions</Text>
              <Text style={styles.heroBody}>
                The same set for everyone. Answer on the keypad; the clock runs until the last question.
              </Text>
              <Button variant="onHero" label="Start today’s challenge" onPress={() => router.push('/challenge')} />
            </>
          )}
          {streak ? (
            <HeroStats
              stats={[
                { value: String(streak.current), label: 'Day streak' },
                { value: String(streak.best), label: 'Best' },
                { value: String(streak.freezesLeft), label: 'Freezes left' },
              ]}
            />
          ) : null}
        </Hero>
      ) : null}

      {streak ? (
        <>
          <SectionHeader title="This week" icon={{ ios: 'flame.fill', android: 'local_fire_department' }} tone="amber" />
          <Card>
            <StreakStrip streak={streak} />
            {streak.atRisk ? (
              <Text style={[styles.body, { color: palette.warning }]}>Play today to keep your streak.</Text>
            ) : null}
          </Card>
        </>
      ) : null}

      <SectionHeader title="What’s in it" icon={{ ios: 'square.grid.2x2.fill', android: 'grid_view' }} tone="blue" />
      <Group>
        {[
          <Row key="seq" icon={{ ios: 'arrow.right', android: 'arrow_forward' }} tone="blue" title="Number sequences" subtitle="Find what comes next" />,
          <Row key="maths" icon={{ ios: 'plus.forwardslash.minus', android: 'calculate' }} tone="green" title="Mental arithmetic" subtitle="Quick sums, no calculator" />,
          <Row key="frac" icon={{ ios: 'divide', android: 'percent' }} tone="amber" title="Fractions" subtitle="Simplify and compare" />,
          <Row key="reason" icon={{ ios: 'lightbulb.fill', android: 'lightbulb' }} tone="blue" title="Reasoning" subtitle="Pick the right answer" />,
          <Row
            key="board"
            icon={{ ios: 'trophy.fill', android: 'emoji_events' }}
            tone="blue"
            title="Today’s leaderboard"
            subtitle="Score first, then time"
            chevron
            onPress={() => router.navigate('/ranks?board=daily')}
          />,
        ]}
      </Group>

      {error ? <Text style={[styles.body, { color: palette.danger }]}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroTitle: {
    color: onHero.text,
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '700',
    letterSpacing: -0.7,
    marginBottom: -Spacing.two,
  },
  heroBody: {
    color: onHero.secondary,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '400',
    letterSpacing: 0,
  },
  heroScore: {
    color: onHero.text,
    fontSize: 44,
    lineHeight: 50,
    fontWeight: '700',
    letterSpacing: -1.4,
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
  },
});
