import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Chip, Empty, Loading, Screen, Title } from '@/components/ui';
import { Spacing, Tabular } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { formatDuration } from '@/lib/daily/answers';
import { pinnedRow, TIER_LABELS, timeLeft, zoneLabel } from '@/lib/leaderboard';
import {
  getDailyBoard,
  getLeague,
  getOverallBoard,
  SiteApiMissing,
  type Board,
  type BoardEntry,
  type DailyPeriod,
  type League,
  type LeagueZone,
  type OverallPeriod,
} from '@/lib/site-api';
import { hideSplash } from '@/lib/splash';
import { openWebPage } from '@/lib/web-pages';

type Which = 'daily' | 'overall' | 'league';

function boardParam(value: string | undefined): Which | null {
  return value === 'daily' || value === 'overall' || value === 'league' ? value : null;
}

type Loaded =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'error'; message: string }
  | { kind: 'board'; board: Board }
  | { kind: 'league'; league: League };

const DAILY_PERIODS: [DailyPeriod, string][] = [
  ['today', 'Today'],
  ['month', 'This month'],
  ['all', 'All time'],
];

const OVERALL_PERIODS: [OverallPeriod, string][] = [
  ['all', 'All time'],
  ['month', 'This month'],
];

/**
 * The daily board, the overall board across every ranked drill, and the weekly league.
 * Your own row is pinned to the bottom so you never scroll to find yourself.
 */
export default function RanksScreen() {
  const palette = usePalette();
  const params = useLocalSearchParams<{ board?: string }>();
  const [which, setWhichState] = useState<Which>(() => boardParam(params.board) ?? 'daily');
  const [dailyPeriod, setDailyPeriodState] = useState<DailyPeriod>('today');
  const [overallPeriod, setOverallPeriodState] = useState<OverallPeriod>('all');
  const [loaded, setLoaded] = useState<Loaded>({ kind: 'loading' });
  const [refreshing, setRefreshing] = useState(false);

  // A link to /ranks?board=league switches boards even when the tab is already open.
  const [seenParam, setSeenParam] = useState(params.board);
  if (params.board !== seenParam) {
    setSeenParam(params.board);
    const board = boardParam(params.board);
    if (board && board !== which) {
      setWhichState(board);
      setLoaded({ kind: 'loading' });
    }
  }

  function setWhich(next: Which) {
    if (next === which) return;
    setWhichState(next);
    setLoaded({ kind: 'loading' });
  }
  function setDailyPeriod(next: DailyPeriod) {
    setDailyPeriodState(next);
    setLoaded({ kind: 'loading' });
  }
  function setOverallPeriod(next: OverallPeriod) {
    setOverallPeriodState(next);
    setLoaded({ kind: 'loading' });
  }

  const load = useCallback(async () => {
    try {
      if (which === 'league') {
        setLoaded({ kind: 'league', league: await getLeague() });
      } else {
        const board = which === 'daily' ? await getDailyBoard(dailyPeriod) : await getOverallBoard(overallPeriod);
        setLoaded({ kind: 'board', board });
      }
    } catch (error) {
      setLoaded(
        error instanceof SiteApiMissing
          ? { kind: 'missing' }
          : { kind: 'error', message: error instanceof Error ? error.message : String(error) },
      );
    }
  }, [which, dailyPeriod, overallPeriod]);

  useFocusEffect(
    useCallback(() => {
      hideSplash();
      void load();
    }, [load]),
  );

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const pinned =
    loaded.kind === 'board' ? pinnedRow(loaded.board) : null;
  const leagueYou = loaded.kind === 'league' ? loaded.league.members.find((m) => m.isYou) : null;

  const footer =
    pinned || leagueYou ? (
      <View style={[styles.pinned, { backgroundColor: palette.surface, borderTopColor: palette.hair }]}>
        {pinned ? (
          <Row entry={pinned} which={which} pinned />
        ) : leagueYou && loaded.kind === 'league' ? (
          <Row
            entry={{ rank: leagueYou.rank, username: leagueYou.username, isYou: true, university: null, score: leagueYou.points }}
            which="league"
            zone={leagueYou.zone}
            pinned
          />
        ) : null}
      </View>
    ) : null;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh} footer={footer}>
      <Title kicker="Ranks" title="Leaderboards." subtitle="Same boards as the website." />

      <View style={styles.chips}>
        <Chip label="Daily" selected={which === 'daily'} onPress={() => setWhich('daily')} />
        <Chip label="Overall" selected={which === 'overall'} onPress={() => setWhich('overall')} />
        <Chip label="League" selected={which === 'league'} onPress={() => setWhich('league')} />
      </View>

      {which === 'daily' ? (
        <View style={styles.chips}>
          {DAILY_PERIODS.map(([period, label]) => (
            <Chip key={period} label={label} selected={dailyPeriod === period} onPress={() => setDailyPeriod(period)} />
          ))}
        </View>
      ) : null}
      {which === 'overall' ? (
        <View style={styles.chips}>
          {OVERALL_PERIODS.map(([period, label]) => (
            <Chip key={period} label={label} selected={overallPeriod === period} onPress={() => setOverallPeriod(period)} />
          ))}
        </View>
      ) : null}

      {loaded.kind === 'loading' ? <Loading /> : null}
      {loaded.kind === 'error' ? <Text style={{ color: palette.danger }}>{loaded.message}</Text> : null}
      {loaded.kind === 'missing' ? (
        <Empty
          title="See the leaderboards on the website"
          body="The app version goes live with the next simplytk.com update."
          action={
            <Button
              label="Open the leaderboard"
              onPress={() =>
                which === 'league' ? openWebPage('/league', 'League') : openWebPage('/oa-leaderboard', 'Leaderboard')
              }
            />
          }
        />
      ) : null}

      {loaded.kind === 'board' ? (
        loaded.board.entries.length === 0 ? (
          <Empty title="No scores yet" body="Be the first on the board." />
        ) : (
          <View style={[styles.table, { borderColor: palette.hair, backgroundColor: palette.surface }]}>
            {loaded.board.entries.map((entry, index) => (
              <View key={`${entry.rank}-${index}`} style={index > 0 && { borderTopColor: palette.hair, borderTopWidth: 1 }}>
                <Row entry={entry} which={which} />
              </View>
            ))}
            <Text style={[styles.players, Tabular, { color: palette.faint }]}>
              {loaded.board.players} {loaded.board.players === 1 ? 'player' : 'players'}
            </Text>
          </View>
        )
      ) : null}

      {loaded.kind === 'league' ? <LeagueTable league={loaded.league} /> : null}

      <Button variant="secondary" label="Challenge a friend 1v1" onPress={() => openWebPage('/1v1', '1v1 challenge')} />
    </Screen>
  );
}

function LeagueTable({ league }: { league: League }) {
  const palette = usePalette();
  return (
    <View style={{ gap: Spacing.three }}>
      <Text style={[styles.leagueHead, Tabular, { color: palette.textSecondary }]}>
        {TIER_LABELS[league.tier]} league · {timeLeft(league.endsAt, new Date())} · top places promote
      </Text>
      <View style={[styles.table, { borderColor: palette.hair, backgroundColor: palette.surface }]}>
        {league.members.map((member, index) => (
          <View key={`${member.rank}-${index}`} style={index > 0 && { borderTopColor: palette.hair, borderTopWidth: 1 }}>
            <Row
              entry={{ rank: member.rank, username: member.username, isYou: member.isYou, university: member.university, score: member.points }}
              which="league"
              zone={member.zone}
              tier={league.tier}
            />
          </View>
        ))}
      </View>
      <Text style={[styles.players, { color: palette.faint }]}>
        Points for ranked drill runs, the daily challenge and 1v1s. Resets Monday at midnight, London time.
      </Text>
    </View>
  );
}

function Row({
  entry,
  which,
  zone,
  tier,
  pinned,
}: {
  entry: BoardEntry;
  which: Which;
  zone?: LeagueZone;
  tier?: League['tier'];
  pinned?: boolean;
}) {
  const palette = usePalette();
  const zoneColor = zone === 'promote' ? palette.success : zone === 'demote' ? palette.danger : palette.textSecondary;
  const score =
    which === 'daily'
      ? `${entry.score}${entry.durationMs != null ? ` · ${formatDuration(entry.durationMs)}` : ''}`
      : which === 'league'
        ? `${entry.score} pts`
        : `${entry.score}`;
  return (
    <View
      accessibilityLabel={`${pinned ? 'You: ' : ''}rank ${entry.rank}, ${entry.username ?? 'Anonymous'}, ${score}`}
      style={[styles.row, entry.isYou && !pinned && { backgroundColor: palette.tintSoft }]}>
      <Text style={[styles.rank, Tabular, { color: entry.isYou ? palette.tint : palette.textSecondary }]}>{entry.rank}</Text>
      <View style={styles.name}>
        <Text style={[styles.username, { color: palette.text }]} numberOfLines={1}>
          {pinned ? 'You' : (entry.username ?? 'Anonymous')}
          {entry.isYou && !pinned ? ' (you)' : ''}
        </Text>
        {zone && (pinned || zone !== 'stay') ? (
          <Text style={[styles.sub, { color: zoneColor }]}>{zoneLabel(zone, tier ?? 'bronze')}</Text>
        ) : entry.university ? (
          <Text style={[styles.sub, { color: palette.faint }]} numberOfLines={1}>
            {entry.university}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.score, Tabular, { color: palette.text }]}>{score}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  table: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    minHeight: 52,
  },
  rank: {
    width: 32,
    fontSize: 15,
    fontWeight: '600',
  },
  name: {
    flex: 1,
    paddingVertical: Spacing.two,
  },
  username: {
    fontSize: 15,
    fontWeight: '500',
  },
  sub: {
    fontSize: 12,
    marginTop: 1,
  },
  score: {
    fontSize: 15,
    fontWeight: '600',
  },
  players: {
    fontSize: 12,
    padding: Spacing.three,
    textAlign: 'center',
  },
  leagueHead: {
    fontSize: 14,
  },
  pinned: {
    borderTopWidth: 1,
  },
});
