import { SymbolView } from 'expo-symbols';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text, TextInput } from '@/components/text';
import { Button, Card, Chip, Empty, Hero, HeroStats, Kicker, Loading, onHero, Pill, Screen, SectionHeader, Title } from '@/components/ui';
import { Spacing, Tabular } from '@/constants/theme';
import { useLoad } from '@/hooks/use-load';
import { usePalette } from '@/hooks/use-palette';
import {
  currentCycle,
  daysUntil,
  evidenceCopy,
  expectedStatus,
  formatWindow,
  groupExpected,
  lastOpened,
  matchesSearch,
  programmeLabel,
  STATUS_LABELS,
  type ExpectedRow,
} from '@/lib/openings/expected';
import { fetchExpected } from '@/lib/openings/queries';
import { hideSplash } from '@/lib/splash';
import { PRE_UNI_TYPES, TYPES } from '@/lib/tracker/openings';

const UNI_PROGRAMMES = [...TYPES];
const SCHOOL_PROGRAMMES = [...PRE_UNI_TYPES];

/**
 * When each firm's programme is expected to open, from when it opened last cycle: the
 * website's /expected-openings page, and the pre-uni tracker's "opening soon" list.
 */
export default function OpeningSoonScreen() {
  const palette = usePalette();
  const params = useLocalSearchParams<{ stage?: string }>();
  const school = params.stage === 'preuni';
  const [query, setQuery] = useState('');
  const [type, setType] = useState<string | null>(null);
  const programmes = school ? SCHOOL_PROGRAMMES : UNI_PROGRAMMES;
  const { data, error, refreshing, refresh } = useLoad(() => fetchExpected(programmes), school ? 'preuni' : 'uni');

  useFocusEffect(hideSplash);

  const now = useMemo(() => new Date(), [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = useMemo(
    () => (data ?? []).filter((row) => (!type || row.programme_type === type) && matchesSearch(row, query)),
    [data, type, query],
  );
  const groups = groupExpected(shown, now);
  const thisWeek = (data ?? []).filter((row) => {
    const days = daysUntil(row, now);
    return expectedStatus(row, now) === 'due' || (days >= 0 && days <= 7);
  }).length;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Title eyebrow={`${currentCycle(now)} cycle`} title="Opening soon" />

      <Hero>
        <Kicker color={onHero.secondary}>{school ? 'School-age programmes' : 'Before they open'}</Kicker>
        <Text style={styles.heroBody}>
          When each programme is expected to open, from when it opened last time. Get your CV ready before the window.
        </Text>
        <HeroStats
          stats={[
            { value: data ? String(data.length) : '–', label: 'Predicted' },
            { value: data ? String(thisWeek) : '–', label: 'Due this week' },
          ]}
        />
      </Hero>

      <View style={[styles.search, { backgroundColor: palette.raised }]}>
        <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} tintColor={palette.faint} size={17} />
        <TextInput
          accessibilityLabel="Search firms and programmes"
          placeholder="Search a firm or programme"
          placeholderTextColor={palette.faint}
          autoCorrect={false}
          clearButtonMode="while-editing"
          value={query}
          onChangeText={setQuery}
          style={[styles.searchInput, { color: palette.text }]}
        />
      </View>

      <View style={styles.chips}>
        <Chip label="All" selected={type === null} onPress={() => setType(null)} />
        {programmes.map((programme) => (
          <Chip
            key={programme}
            label={programmeLabel(programme)}
            selected={type === programme}
            onPress={() => setType(type === programme ? null : programme)}
          />
        ))}
      </View>

      {error && !data ? (
        <Empty title="Couldn’t load the predictions" body={error} action={<Button variant="secondary" label="Try again" onPress={refresh} />} />
      ) : !data ? (
        <Loading />
      ) : groups.length === 0 ? (
        <Empty
          title={data.length ? 'Nothing matches' : 'Nothing predicted right now'}
          body={data.length ? 'Try another firm or programme.' : 'Everything we expected this cycle has opened. It’s all in the Tracker.'}
        />
      ) : (
        groups.map((group) => (
          <View key={group.key} style={styles.section}>
            <SectionHeader
              title={group.title}
              icon={
                group.key === 'due'
                  ? { ios: 'bell.badge.fill', android: 'notifications_active' }
                  : group.key === 'upcoming'
                    ? { ios: 'calendar', android: 'calendar_month' }
                    : { ios: 'hourglass', android: 'hourglass_top' }
              }
              tone={group.key === 'due' ? 'blue' : group.key === 'upcoming' ? 'green' : 'amber'}
              count={group.rows.length}
            />
            {group.rows.map((row) => (
              <Prediction key={row.id} row={row} now={now} />
            ))}
          </View>
        ))
      )}
    </Screen>
  );
}

function Prediction({ row, now }: { row: ExpectedRow; now: Date }) {
  const palette = usePalette();
  const status = expectedStatus(row, now);
  const days = daysUntil(row, now);
  return (
    <Card style={styles.card}>
      <View style={styles.cardHead}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.firm, { color: palette.text }]} numberOfLines={1}>
            {row.company_name}
          </Text>
          <Text style={[styles.programme, { color: palette.textSecondary }]}>{programmeLabel(row.programme_type)}</Text>
        </View>
        <Pill
          label={status === 'upcoming' && days > 0 ? `In ${days} day${days === 1 ? '' : 's'}` : STATUS_LABELS[status]}
          tone={status === 'due' ? 'blue' : status === 'overdue' ? 'amber' : 'green'}
        />
      </View>
      <View style={styles.facts}>
        <View style={{ flex: 1 }}>
          <Kicker>Expected</Kicker>
          <Text style={[styles.fact, Tabular, { color: palette.text }]}>{formatWindow(row)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Kicker>Opened last cycle</Kicker>
          <Text style={[styles.fact, Tabular, { color: palette.text }]}>{lastOpened(row)}</Text>
        </View>
      </View>
      <Text style={[styles.evidence, { color: palette.textSecondary }]}>{evidenceCopy(row)}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  heroBody: {
    color: onHero.secondary,
    fontSize: 15,
    lineHeight: 21,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  section: {
    gap: Spacing.three,
  },
  card: {
    gap: Spacing.three,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  firm: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  programme: {
    fontSize: 14,
    marginTop: 2,
  },
  facts: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  fact: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 4,
  },
  evidence: {
    fontSize: 13,
    lineHeight: 18,
  },
});
