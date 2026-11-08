import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { OpeningCard } from '@/components/opening-card';
import { StreakStrip } from '@/components/streak-strip';
import { Text } from '@/components/text';
import {
  Button,
  Card,
  Empty,
  GlassButton,
  Group,
  Hero,
  HeroStats,
  Kicker,
  onHero,
  Row,
  Screen,
  SectionHeader,
  Title,
} from '@/components/ui';
import { Spacing, Tabular } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { formatDuration } from '@/lib/daily/answers';
import { refreshDaily, useDaily } from '@/lib/daily/store';
import { TIER_LABELS, timeLeft, zoneLabel } from '@/lib/leaderboard';
import { openOutside } from '@/lib/open';
import { useSession } from '@/lib/session';
import { hideSplash } from '@/lib/splash';
import { loadStars, useStars } from '@/lib/stars';
import { daysLeft, deadlineLabel, upcomingStarred } from '@/lib/tracker/openings';
import { openWebPage } from '@/lib/web-pages';

/** How many starred openings Home lists before "See all". */
const STARRED_ON_HOME = 3;

function greeting(now: Date) {
  const hour = Number(now.toLocaleString('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Europe/London' }));
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function today(now: Date) {
  return now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

/**
 * Home, laid out like Orbit's: today's challenge on the navy card with the numbers that
 * matter under it, then what needs doing (starred openings about to close, a streak at
 * risk), the week at a glance, and the starred openings.
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

  const closingSoon = upcoming.filter((o) => {
    if (!o.deadline) return false;
    const left = daysLeft(o.deadline, now);
    return left >= 0 && left <= 7;
  });
  const streakAtRisk = !!streak?.atRisk && !daily?.result;
  const attention = closingSoon.length + (streakAtRisk ? 1 : 0);

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Title
        eyebrow={today(now)}
        title={name ? `${greeting(now)}, ${name}` : greeting(now)}
        actions={
          <>
            <GlassButton
              icon={{ ios: 'magnifyingglass', android: 'search' }}
              label="Search openings"
              onPress={() => router.navigate('/tracker')}
            />
            <GlassButton
              icon={{ ios: 'person.crop.circle', android: 'account_circle' }}
              label="More"
              onPress={() => router.navigate('/more')}
            />
          </>
        }
      />

      <Hero>
        <View style={styles.heroHead}>
          <Kicker color={onHero.secondary}>Today’s challenge</Kicker>
          {daily ? <Text style={[styles.heroNumber, Tabular]}>#{daily.number}</Text> : null}
        </View>
        {missing ? (
          <>
            <Text style={styles.heroTitle}>Play on the website</Text>
            <Text style={styles.heroBody}>The app can’t load today’s set right now, but it’s ready on simplytk.com.</Text>
            <Button variant="onHero" label="Play on simplytk.com" onPress={() => openWebPage('/daily', 'Daily challenge')} />
          </>
        ) : daily?.result ? (
          <>
            <Text style={[styles.heroScore, Tabular]}>
              {daily.result.score}/{daily.result.total}
              <Text style={styles.heroBody}>{`  in ${formatDuration(daily.result.durationMs)}`}</Text>
            </Text>
            <Text style={styles.heroBody}>Done for today. A new set lands at midnight.</Text>
          </>
        ) : (
          <>
            <Text style={styles.heroTitle}>Daily Challenge</Text>
            <Text style={styles.heroBody}>
              {daily
                ? `${daily.total} quick questions, the same for everyone. Your time is the tiebreaker.`
                : 'Today’s questions are waiting.'}
            </Text>
            <Button variant="onHero" label="Start challenge" onPress={() => router.push('/challenge')} />
          </>
        )}
        <HeroStats
          stats={[
            { value: streak ? String(streak.current) : '–', label: 'Day streak' },
            { value: streak ? String(streak.best) : '–', label: 'Best' },
            { value: league ? `#${league.you.rank}` : '–', label: league ? `${TIER_LABELS[league.tier]} league` : 'League' },
            { value: stars.list ? String(upcoming.length) : '–', label: 'Starred' },
          ]}
        />
      </Hero>

      {attention > 0 ? (
        <>
          <SectionHeader title="Needs attention" icon={{ ios: 'bell.fill', android: 'notifications' }} tone="amber" count={attention} />
          <Group>
            {[
              streakAtRisk && streak ? (
                <Row
                  key="streak"
                  icon={{ ios: 'flame.fill', android: 'local_fire_department' }}
                  tone="amber"
                  title={`Keep your ${streak.current}-day streak`}
                  subtitle="Play today’s challenge before midnight"
                  pill={{ label: 'Play' }}
                  onPress={() => router.push('/challenge')}
                />
              ) : null,
              ...closingSoon.slice(0, 3).map((opening) => {
                const label = deadlineLabel(opening.deadline, now);
                return (
                  <Row
                    key={opening.id}
                    icon={{ ios: 'clock.fill', android: 'schedule' }}
                    tone={label.tone === 'urgent' ? 'red' : 'amber'}
                    title={`Apply to ${opening.companies?.name ?? 'this opening'}`}
                    subtitle={`${label.text} · ${opening.title}`}
                    pill={{ label: 'Apply', tone: 'blue', onPress: () => void openOutside(opening.apply_url, 'browser') }}
                    onPress={() => router.push({ pathname: '/opening/[id]', params: { id: opening.id } })}
                  />
                );
              }),
            ]}
          </Group>
        </>
      ) : null}

      <SectionHeader title="At a glance" icon={{ ios: 'chart.bar.fill', android: 'bar_chart' }} tone="green" />
      <View style={styles.glance}>
        <Card style={styles.glanceCard} onPress={() => router.navigate('/daily')} accessibilityLabel="Streak">
          <Kicker color={palette.tint}>This week</Kicker>
          <Text style={[styles.glanceValue, Tabular, { color: palette.text }]}>
            {streak ? streak.week.filter((d) => d.played).length : '–'}
            <Text style={[styles.glanceUnit, { color: palette.textSecondary }]}> / 7 days</Text>
          </Text>
          {streak ? <StreakStrip streak={streak} height={30} /> : null}
        </Card>
        <Card style={styles.glanceCard} onPress={() => router.navigate('/ranks?board=league')} accessibilityLabel="League">
          <Kicker color={palette.purple}>League</Kicker>
          <Text style={[styles.glanceValue, Tabular, { color: palette.text }]}>
            {league ? `#${league.you.rank}` : '–'}
            {league ? (
              <Text style={[styles.glanceUnit, { color: palette.textSecondary }]}> of {league.members.length}</Text>
            ) : null}
          </Text>
          <Text style={[styles.glanceNote, { color: palette.textSecondary }]} numberOfLines={2}>
            {league
              ? `${zoneLabel(league.you.zone, league.tier)} · resets in ${timeLeft(league.endsAt, now).replace(' left', '')}`
              : 'Weekly league'}
          </Text>
        </Card>
      </View>

      <SectionHeader
        title="Starred"
        icon={{ ios: 'star.fill', android: 'star' }}
        count={stars.list ? upcoming.length : undefined}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroNumber: {
    color: onHero.secondary,
    fontSize: 13,
    fontWeight: '600',
  },
  heroTitle: {
    color: onHero.text,
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '700',
    letterSpacing: -0.6,
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
    fontSize: 38,
    fontWeight: '700',
    letterSpacing: -1.2,
  },
  glance: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  glanceCard: {
    flex: 1,
    gap: Spacing.two,
  },
  glanceValue: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  glanceUnit: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0,
  },
  glanceNote: {
    fontSize: 13,
    lineHeight: 18,
  },
  list: {
    gap: Spacing.three,
  },
});
