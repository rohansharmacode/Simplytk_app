import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { Button, Empty, Loading, Screen, Segmented, Title } from '@/components/ui';
import { cardShadow, Radius, Spacing, Tabular } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { formatDuration } from '@/lib/daily/answers';
import { pinnedRow, playerBoard, TIER_LABELS, timeLeft, universityBoard, zoneLabel } from '@/lib/leaderboard';
import {
  getLeaderboards,
  getLeague,
  SiteApiMissing,
  type Board,
  type BoardEntry,
  type DailyPeriod,
  type League,
  type LeagueZone,
} from '@/lib/site-api';
import { hideSplash } from '@/lib/splash';
import { openWebPage } from '@/lib/web-pages';

type Which = 'daily' | 'universities' | 'league';

function boardParam(value: string | undefined): Which | null {
  return value === 'daily' || value === 'universities' || value === 'league' ? value : null;
}

type Loaded =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'error'; message: string }
  | { kind: 'board'; board: Board }
  | { kind: 'league'; league: League };

const BOARDS: [Which, string][] = [
  ['daily', 'Daily'],
  ['universities', 'Universities'],
  ['league', 'League'],
];

const DAILY_PERIODS: [DailyPeriod, string][] = [
  ['today', 'Today'],
  ['month', 'This month'],
  ['all', 'All time'],
];

/**
 * The daily challenge's player and university boards, and the weekly league.
 * Your own row is pinned to the bottom so you never scroll to find yourself.
 */
export default function RanksScreen() {
  const palette = usePalette();
  const params = useLocalSearchParams<{ board?: string }>();
  const [which, setWhichState] = useState<Which>(() => boardParam(params.board) ?? 'daily');
  const [period, setPeriodState] = useState<DailyPeriod>('today');
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
  function setPeriod(next: DailyPeriod) {
    if (next === period) return;
    setPeriodState(next);
    setLoaded({ kind: 'loading' });
  }

  const load = useCallback(async () => {
    try {
      if (which === 'league') {
        setLoaded({ kind: 'league', league: await getLeague() });
      } else {
        const boards = await getLeaderboards(period);
        const board = which === 'daily' ? playerBoard(boards.board) : universityBoard(boards.universities);
        setLoaded({ kind: 'board', board });
      }
    } catch (error) {
      setLoaded(
        error instanceof SiteApiMissing
          ? { kind: 'missing' }
          : { kind: 'error', message: error instanceof Error ? error.message : String(error) },
      );
    }
  }, [which, period]);

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
          <Row entry={pinned} which={which} showTime={period === 'today'} pinned />
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
      <Title title="Ranks" subtitle="The same leaderboards as the website." />

      <Segmented options={BOARDS} value={which} onChange={setWhich} />

      {which !== 'league' ? <Segmented options={DAILY_PERIODS} value={period} onChange={setPeriod} /> : null}

      {loaded.kind === 'loading' ? <Loading /> : null}
      {loaded.kind === 'error' ? <Text style={{ color: palette.danger }}>{loaded.message}</Text> : null}
      {loaded.kind === 'missing' ? (
        <Empty
          title="See the leaderboards on the website"
          body="The app can’t load them right now."
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
          <View style={[styles.table, { borderColor: palette.hair, backgroundColor: palette.surface }, cardShadow(palette.shadow)]}>
            {loaded.board.entries.map((entry, index) => (
              <View key={`${entry.rank}-${index}`} style={index > 0 && { borderTopColor: palette.hair, borderTopWidth: 1 }}>
                <Row entry={entry} which={which} showTime={period === 'today'} />
              </View>
            ))}
            <Text style={[styles.players, Tabular, { color: palette.faint }]}>
              {loaded.board.players}{' '}
              {which === 'universities'
                ? loaded.board.players === 1
                  ? 'university'
                  : 'universities'
                : loaded.board.players === 1
                  ? 'player'
                  : 'players'}
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
      <View style={[styles.table, { borderColor: palette.hair, backgroundColor: palette.surface }, cardShadow(palette.shadow)]}>
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
  showTime,
  pinned,
}: {
  entry: BoardEntry;
  which: Which;
  zone?: LeagueZone;
  tier?: League['tier'];
  /** Show each run's time: the today board, where the score is one run's. */
  showTime?: boolean;
  pinned?: boolean;
}) {
  const palette = usePalette();
  const zoneColor = zone === 'promote' ? palette.success : zone === 'demote' ? palette.danger : palette.textSecondary;
  const score =
    entry.score == null
      ? '–'
      : which === 'daily'
        ? `${entry.score}${showTime && entry.durationMs != null ? ` · ${formatDuration(entry.durationMs)}` : ''}`
        : `${entry.score} pts`;
  const name = pinned && which !== 'universities' ? 'You' : (entry.username ?? 'Anonymous');
  const sub = entry.detail ?? entry.university;
  return (
    <View
      accessibilityLabel={`${pinned ? 'You: ' : ''}rank ${entry.rank}, ${entry.username ?? 'Anonymous'}, ${score}`}
      style={[styles.row, entry.isYou && !pinned && { backgroundColor: palette.tintSoft }]}>
      <View style={styles.rankCell}>
        {entry.rank <= 3 && !pinned ? (
          <View style={[styles.medal, { backgroundColor: MEDALS[entry.rank - 1] }]}>
            <Text style={[styles.medalText, Tabular]}>{entry.rank}</Text>
          </View>
        ) : (
          <Text style={[styles.rank, Tabular, { color: entry.isYou ? palette.tint : palette.textSecondary }]}>
            {entry.rank}
          </Text>
        )}
      </View>
      <View style={styles.name}>
        <Text style={[styles.username, { color: palette.text }]} numberOfLines={1}>
          {name}
          {entry.isYou && !pinned ? (which === 'universities' ? ' (yours)' : ' (you)') : ''}
        </Text>
        {zone && (pinned || zone !== 'stay') ? (
          <Text style={[styles.sub, { color: zoneColor }]}>{zoneLabel(zone, tier ?? 'bronze')}</Text>
        ) : sub ? (
          <Text style={[styles.sub, { color: palette.faint }]} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.score, Tabular, { color: entry.score == null ? palette.faint : palette.tint }]}>{score}</Text>
    </View>
  );
}

/** Gold, silver and bronze, as the website's podium. */
const MEDALS = ['#F5B323', '#A7B0BE', '#CD8A55'];

const styles = StyleSheet.create({
  table: {
    borderWidth: 1,
    borderRadius: Radius.card,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    minHeight: 52,
  },
  rankCell: {
    width: 30,
    alignItems: 'center',
  },
  rank: {
    fontSize: 15,
    fontWeight: '600',
  },
  medal: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medalText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  name: {
    flex: 1,
    paddingVertical: Spacing.two,
  },
  username: {
    fontSize: 15,
    fontWeight: '600',
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
