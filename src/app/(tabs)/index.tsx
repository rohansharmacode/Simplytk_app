import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { OpeningCard } from '@/components/opening-card';
import { StreakStrip } from '@/components/streak-strip';
import { Text } from '@/components/text';
import { Button, Card, Empty, IconTile, Screen, SectionHeader, Stat, Title, Wordmark } from '@/components/ui';
import { Spacing, Tabular } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { formatDuration } from '@/lib/daily/answers';
import { refreshDaily, useDaily } from '@/lib/daily/store';
import { leagueLine, timeLeft, zoneLabel } from '@/lib/leaderboard';
import { useSession } from '@/lib/session';
import { hideSplash } from '@/lib/splash';
import { loadStars, useStars } from '@/lib/stars';
import { daysLeft, upcomingStarred } from '@/lib/tracker/openings';
import { openWebPage } from '@/lib/web-pages';

/** How many starred openings Home lists before "See all". */
const STARRED_ON_HOME = 4;

function greeting(now: Date) {
  const hour = Number(now.toLocaleString('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Europe/London' }));
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Home: starred openings closing soonest, today's challenge, the streak and the league
 * place. Everything a student checks in a few seconds.
 */
export default function HomeScreen() {
  const palette = usePalette();
  const session = useSession();
  const stars = useStars();
  const { daily, streak, league, missing } = useDaily();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      hideSplash();
      void refreshDaily();
    }, []),
  );

  async function refresh() {
    setRefreshing(true);
    await Promise.all([refreshDaily(), loadStars()]);
    setRefreshing(false);
  }

  const now = new Date();
  const upcoming = useMemo(() => upcomingStarred(stars.list ?? [], new Date()), [stars.list]);
  const name = (session?.user.user_metadata?.full_name as string | undefined)?.split(' ')[0];

  const closingThisWeek = upcoming.filter((o) => {
    if (!o.deadline) return false;
    const left = daysLeft(o.deadline, now);
    return left >= 0 && left <= 7;
  }).length;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <View style={styles.brand}>
        <Wordmark />
      </View>

      <Title
        title={name ? `${greeting(now)}, ${name}` : greeting(now)}
        subtitle={
          closingThisWeek > 0
            ? `${closingThisWeek} starred ${closingThisWeek === 1 ? 'opening closes' : 'openings close'} this week.`
            : undefined
        }
      />

      <View style={styles.stats}>
        <Card style={styles.statCard} onPress={() => router.navigate('/daily')} accessibilityLabel="Streak">
          <IconTile icon={{ ios: 'flame.fill', android: 'local_fire_department' }} color={palette.warning} />
          <Stat
            value={streak ? `${streak.current} ${streak.current === 1 ? 'day' : 'days'}` : '–'}
            label={streak?.atRisk ? 'Play today to keep it' : 'Daily streak'}
            color={streak?.atRisk ? palette.warning : undefined}
          />
        </Card>
        <Card style={styles.statCard} onPress={() => router.navigate('/ranks?board=league')} accessibilityLabel="League">
          <IconTile icon={{ ios: 'trophy.fill', android: 'trophy' }} />
          {league ? (
            <Stat value={`#${league.you.rank}`} label={leagueLine(league).replace(/^\S+ /, '')} />
          ) : (
            <Stat value="–" label={missing ? 'On the website' : 'Weekly league'} />
          )}
        </Card>
      </View>

      <Card style={styles.daily}>
        <View style={styles.dailyHead}>
          <Text style={[styles.dailyTitle, { color: palette.text }]}>Daily Challenge</Text>
          {daily ? (
            <Text style={[styles.dailyNumber, Tabular, { color: palette.textSecondary }]}>#{daily.number}</Text>
          ) : null}
        </View>
        {missing ? (
          <>
            <Text style={[styles.body, { color: palette.textSecondary }]}>
              The app can’t load today’s set right now, but it’s ready on the website.
            </Text>
            <Button label="Play on simplytk.com" onPress={() => openWebPage('/daily', 'Daily challenge')} />
          </>
        ) : daily?.result ? (
          <>
            <Text style={[styles.dailyScore, Tabular, { color: palette.text }]}>
              {daily.result.score}/{daily.result.total}
              <Text style={[styles.body, { color: palette.textSecondary }]}>
                {`  in ${formatDuration(daily.result.durationMs)}`}
              </Text>
            </Text>
            <Text style={[styles.body, { color: palette.textSecondary }]}>Done for today. A new set lands at midnight.</Text>
          </>
        ) : (
          <>
            <Text style={[styles.body, { color: palette.textSecondary }]}>
              {daily
                ? `${daily.total} quick questions, the same for everyone. Your time is the tiebreaker.`
                : 'Today’s questions are waiting.'}
            </Text>
            <Button label="Start challenge" onPress={() => router.push('/challenge')} />
          </>
        )}
        {streak ? <StreakStrip streak={streak} /> : null}
      </Card>

      <SectionHeader
        title="Starred"
        action={upcoming.length > STARRED_ON_HOME ? { label: 'See all', onPress: () => router.navigate('/tracker') } : undefined}
      />
      {stars.list === null ? null : upcoming.length === 0 ? (
        <Empty
          title="Star the openings you want"
          body="They show here, nearest deadline first, and you get a notification before each one closes."
          action={<Button variant="secondary" label="Browse the tracker" onPress={() => router.navigate('/tracker')} />}
        />
      ) : (
        <View style={styles.list}>
          {upcoming.slice(0, STARRED_ON_HOME).map((opening) => (
            <OpeningCard key={opening.id} opening={opening} now={now} />
          ))}
        </View>
      )}

      {league ? (
        <Text style={[styles.foot, Tabular, { color: palette.faint }]}>
          League resets in {timeLeft(league.endsAt, now).replace(' left', '')} · {zoneLabel(league.you.zone, league.tier)}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: {
    marginBottom: -Spacing.two,
  },
  stats: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  statCard: {
    flex: 1,
    gap: Spacing.three,
  },
  daily: {
    gap: Spacing.four,
    padding: 18,
  },
  dailyHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  dailyTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  dailyNumber: {
    fontSize: 14,
    fontWeight: '500',
  },
  dailyScore: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -1.2,
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
  },
  list: {
    gap: Spacing.three,
  },
  foot: {
    fontSize: 13,
    textAlign: 'center',
  },
});
