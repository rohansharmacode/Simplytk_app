import { useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OpeningCard } from '@/components/opening-card';
import { Text, TextInput } from '@/components/text';
import { Chip, Empty, Loading, Segmented, Title } from '@/components/ui';
import { cardShadow, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { hideSplash } from '@/lib/splash';
import { loadStars, useStars } from '@/lib/stars';
import {
  activeFilterCount,
  DEADLINE_FILTERS,
  DEADLINE_LABELS,
  DEFAULT_FILTERS,
  REGION_LABELS,
  REGIONS,
  TYPE_LABELS,
  TYPES,
  upcomingStarred,
  type Filters,
  type OpeningType,
} from '@/lib/tracker/openings';
import { fetchOpenings, PAGE_SIZE, type Opening } from '@/lib/tracker/queries';

type View_ = 'all' | 'starred';

/** Wait this long after the last keystroke before searching firms. */
const SEARCH_DELAY_MS = 300;

export default function TrackerScreen() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'android' ? insets.top : 0;
  const [view, setView] = useState<View_>('all');
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [firmInput, setFirmInput] = useState('');
  // Rows with the filters they were loaded for; stale rows show as loading.
  const [result, setResult] = useState<{ filters: Filters; rows: Opening[] } | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stars = useStars();
  const openings = result && result.filters === filters ? result.rows : null;
  // Only the newest request may write results, so fast filter taps can't race.
  const request = useRef(0);
  const now = useMemo(() => new Date(), [openings]); // eslint-disable-line react-hooks/exhaustive-deps

  useFocusEffect(hideSplash);

  useEffect(() => {
    const timer = setTimeout(() => setFilters((f) => ({ ...f, firm: firmInput })), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [firmInput]);

  const load = useCallback((next: Filters, nextPage: number) => {
    const id = ++request.current;
    return fetchOpenings(next, nextPage).then(
      (rows) => {
        if (id !== request.current) return;
        setError(null);
        setResult((current) => ({
          filters: next,
          rows: nextPage === 0 || current?.filters !== next ? rows : [...current.rows, ...rows],
        }));
        setPage(nextPage);
        setHasMore(rows.length === PAGE_SIZE);
      },
      (failure: unknown) => {
        if (id !== request.current) return;
        setError(failure instanceof Error ? failure.message : String(failure));
        if (nextPage === 0) setResult({ filters: next, rows: [] });
      },
    );
  }, []);

  useEffect(() => {
    void load(filters, 0);
  }, [filters, load]);

  async function refresh() {
    setRefreshing(true);
    await Promise.all([load(filters, 0), loadStars()]);
    setRefreshing(false);
  }

  async function loadMore() {
    if (view !== 'all' || !hasMore || loadingMore || openings === null) return;
    setLoadingMore(true);
    await load(filters, page + 1);
    setLoadingMore(false);
  }

  function toggleType(type: OpeningType) {
    setFilters((f) => ({
      ...f,
      types: f.types.includes(type) ? f.types.filter((t) => t !== type) : [...f.types, type],
    }));
  }

  const starred = useMemo(() => upcomingStarred(stars.list ?? [], new Date()), [stars.list]);
  const data = view === 'all' ? (openings ?? []) : starred;
  const filterCount = activeFilterCount(filters);

  const header = (
    <View style={[styles.header, { paddingTop: topInset + Spacing.four }]}>
      <Title title="Tracker" subtitle="Live openings, closing soonest first." />

      <View style={[styles.search, { backgroundColor: palette.surface, borderColor: palette.border }, cardShadow(palette.shadow)]}>
        <SymbolView
          name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
          tintColor={palette.faint}
          size={17}
        />
        <TextInput
          accessibilityLabel="Search firms"
          placeholder="Search by firm"
          placeholderTextColor={palette.faint}
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
          value={firmInput}
          onChangeText={setFirmInput}
          style={[styles.searchInput, { color: palette.text }]}
        />
      </View>

      <Segmented
        options={[
          ['all', 'All openings'],
          ['starred', `Starred${stars.list ? ` · ${starred.length}` : ''}`],
        ]}
        value={view}
        onChange={setView}
      />

      {view === 'all' ? (
        <View style={styles.filters}>
          <ChipRow>
            {REGIONS.map((region) => (
              <Chip
                key={region}
                label={REGION_LABELS[region]}
                selected={filters.region === region}
                onPress={() => setFilters((f) => ({ ...f, region }))}
              />
            ))}
          </ChipRow>
          <ChipRow>
            {TYPES.map((type) => (
              <Chip key={type} label={TYPE_LABELS[type]} selected={filters.types.includes(type)} onPress={() => toggleType(type)} />
            ))}
          </ChipRow>
          <ChipRow>
            {DEADLINE_FILTERS.map((deadline) => (
              <Chip
                key={deadline}
                label={DEADLINE_LABELS[deadline]}
                selected={filters.deadline === deadline}
                onPress={() => setFilters((f) => ({ ...f, deadline }))}
              />
            ))}
          </ChipRow>
          {filterCount > 0 ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => {
                setFirmInput('');
                setFilters(DEFAULT_FILTERS);
              }}>
              <Text style={[styles.clear, { color: palette.tint }]}>Clear filters</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {error ? <Text style={[styles.error, { color: palette.danger }]}>{error}</Text> : null}
    </View>
  );

  const empty =
    view === 'starred' ? (
      stars.list === null ? (
        <Loading />
      ) : (
        <Empty
          title="No starred openings yet"
          body="Tap the star on an opening. You get a notification when its deadline is close."
        />
      )
    ) : openings === null ? (
      <Loading />
    ) : (
      <Empty title="Nothing matches" body="Try another firm, type or deadline, or clear the filters." />
    );

  return (
    <FlatList
      style={{ backgroundColor: palette.background }}
      contentContainerStyle={styles.list}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      data={data}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <OpeningCard opening={item} now={now} />}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      ListFooterComponent={loadingMore ? <Loading /> : null}
      ItemSeparatorComponent={Separator}
      onEndReached={loadMore}
      onEndReachedThreshold={0.6}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={palette.textSecondary} />}
    />
  );
}

function Separator() {
  return <View style={{ height: Spacing.three }} />;
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}
      style={styles.chipScroll}>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
  },
  header: {
    gap: Spacing.four,
    paddingBottom: Spacing.four,
  },
  search: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
  },
  clear: {
    fontSize: 14,
    fontWeight: '600',
  },
  filters: {
    gap: Spacing.two,
  },
  chipScroll: {
    marginHorizontal: -Spacing.four,
  },
  chipRow: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  error: {
    fontSize: 14,
  },
});
