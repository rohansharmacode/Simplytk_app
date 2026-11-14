import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { StreakStrip } from '@/components/streak-strip';
import { Text } from '@/components/text';
import { Card, Group, Hero, HeroStats, Kicker, onHero, Row, Screen, SectionHeader, Title } from '@/components/ui';
import { Spacing, Tabular } from '@/constants/theme';
import { useLoad } from '@/hooks/use-load';
import { usePalette } from '@/hooks/use-palette';
import { fetchApplications } from '@/lib/applications/queries';
import { funnel } from '@/lib/applications/stages';
import { refreshDaily, useDaily } from '@/lib/daily/store';
import { TIER_LABELS, timeLeft, zoneLabel } from '@/lib/leaderboard';
import { hideSplash } from '@/lib/splash';
import { useStars } from '@/lib/stars';
import { daysLeft, upcomingStarred } from '@/lib/tracker/openings';
import { openWebPage } from '@/lib/web-pages';

function percent(part: number, whole: number) {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : '–';
}

/** How the student is getting on: the daily streak, the league, and their applications. */
export default function ProgressScreen() {
  const palette = usePalette();
  const router = useRouter();
  const { streak, league } = useDaily();
  const stars = useStars();
  const applications = useLoad(fetchApplications);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      hideSplash();
      void refreshDaily();
    }, []),
  );

  async function refresh() {
    setRefreshing(true);
    await Promise.all([refreshDaily(), applications.reload()]);
    setRefreshing(false);
  }

  const now = new Date();
  const counts = applications.data ? funnel(applications.data) : null;
  const starred = upcomingStarred(stars.list ?? [], now);
  const closingSoon = starred.filter((o) => o.deadline && daysLeft(o.deadline, now) >= 0 && daysLeft(o.deadline, now) <= 7).length;
  const played = streak ? streak.week.filter((d) => d.played).length : null;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Title eyebrow="You" title="My progress" />

      <Hero>
        <Kicker color={onHero.secondary}>Daily challenge</Kicker>
        <Text style={[styles.heroBig, Tabular]}>
          {streak ? streak.current : '–'}
          <Text style={styles.heroUnit}> day streak</Text>
        </Text>
        <HeroStats
          stats={[
            { value: streak ? String(streak.best) : '–', label: 'Best streak' },
            { value: played == null ? '–' : `${played}/7`, label: 'This week' },
            { value: streak ? String(streak.freezesLeft) : '–', label: 'Freezes left' },
          ]}
        />
      </Hero>

      {streak ? (
        <Card style={styles.card} onPress={() => router.navigate('/daily')} accessibilityLabel="This week">
          <Kicker color={palette.tint}>This week</Kicker>
          <StreakStrip streak={streak} />
        </Card>
      ) : null}

      <SectionHeader title="Applications" icon={{ ios: 'checklist', android: 'checklist' }} count={counts?.tracked} />
      <Card style={styles.card} onPress={() => router.push('/applications')} accessibilityLabel="My applications">
        <View style={styles.funnel}>
          {(
            [
              ['Tracked', counts?.tracked],
              ['Applied', counts?.applied],
              ['Interviews', counts?.interviews],
              ['Offers', counts?.offers],
            ] as const
          ).map(([label, value]) => (
            <View key={label} style={styles.funnelStep}>
              <Text style={[styles.funnelValue, Tabular, { color: palette.text }]}>{value ?? '–'}</Text>
              <Text style={[styles.funnelLabel, { color: palette.textSecondary }]}>{label}</Text>
            </View>
          ))}
        </View>
        <Text style={[styles.note, { color: palette.textSecondary }]}>
          {counts && counts.applied > 0
            ? `${percent(counts.interviews, counts.applied)} of your applications reached an interview.`
            : 'Track what you apply to and this fills in as you go.'}
        </Text>
      </Card>

      <SectionHeader title="Keep going" icon={{ ios: 'bolt.fill', android: 'bolt' }} tone="amber" />
      <Group>
        {[
          <Row
            key="league"
            icon={{ ios: 'trophy.fill', android: 'emoji_events' }}
            tone="amber"
            title={league ? `#${league.you.rank} in the ${TIER_LABELS[league.tier]} league` : 'Weekly league'}
            subtitle={league ? `${zoneLabel(league.you.zone, league.tier)} · ${timeLeft(league.endsAt, now)}` : 'Play the daily challenge to join'}
            chevron
            onPress={() => router.navigate('/ranks?board=league')}
          />,
          <Row
            key="starred"
            icon={{ ios: 'star.fill', android: 'star' }}
            tone="blue"
            title={`${starred.length} starred opening${starred.length === 1 ? '' : 's'}`}
            subtitle={closingSoon ? `${closingSoon} close this week` : 'Nothing closes this week'}
            chevron
            onPress={() => router.navigate('/tracker')}
          />,
          <Row
            key="drills"
            icon={{ ios: 'stopwatch.fill', android: 'timer' }}
            tone="green"
            title="Drills"
            subtitle="The tests firms set, on repeat"
            chevron
            onPress={() => router.push('/drills')}
          />,
          <Row
            key="web"
            icon={{ ios: 'chart.line.uptrend.xyaxis', android: 'trending_up' }}
            tone="blue"
            title="Drill scores and readiness"
            subtitle="Your full progress page on simplytk.com"
            chevron
            onPress={() => openWebPage('/progress', 'My progress')}
          />,
        ]}
      </Group>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroBig: {
    color: onHero.text,
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: -1.2,
  },
  heroUnit: {
    color: onHero.secondary,
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: 0,
  },
  card: {
    gap: Spacing.three,
  },
  funnel: {
    flexDirection: 'row',
  },
  funnelStep: {
    flex: 1,
    gap: 2,
  },
  funnelValue: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  funnelLabel: {
    fontSize: 13,
  },
  note: {
    fontSize: 14,
    lineHeight: 19,
  },
});
