import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { OpeningCard } from "@/components/opening-card";
import { Text, TextInput } from "@/components/text";
import {
  Chip,
  Empty,
  Hero,
  HeroStats,
  Kicker,
  Loading,
  onHero,
  Segmented,
  Title,
  useTopBar,
} from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { usePalette } from "@/hooks/use-palette";
import { hideSplash } from "@/lib/splash";
import { loadStars, useStars } from "@/lib/stars";
import {
  activeFilterCount,
  daysLeft,
  DEADLINE_FILTERS,
  DEADLINE_LABELS,
  DEFAULT_FILTERS,
  REGION_LABELS,
  REGIONS,
  STAGE_LABELS,
  TYPE_LABELS,
  typesFor,
  upcomingStarred,
  type Filters,
  type OpeningType,
  type PreUniType,
  type Stage,
} from "@/lib/tracker/openings";
import { fetchOpenings, PAGE_SIZE, type Opening } from "@/lib/tracker/queries";

type View_ = "all" | "starred";

/** Wait this long after the last keystroke before searching firms. */
const SEARCH_DELAY_MS = 300;

export default function TrackerScreen() {
  const palette = usePalette();
  const topBar = useTopBar();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "android" ? insets.top : 0;
  const router = useRouter();
  const params = useLocalSearchParams<{ stage?: string }>();
  const [view, setView] = useState<View_>("all");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const stage: Stage = filters.stage ?? "uni";
  const [firmInput, setFirmInput] = useState("");
  // Rows with the filters they were loaded for; stale rows show as loading.
  const [result, setResult] = useState<{
    filters: Filters;
    rows: Opening[];
  } | null>(null);
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

  // A link to the pre-university tracker (More, or a simplytk.com link) picks the stage.
  const [linkedStage, setLinkedStage] = useState<string | undefined>(undefined);
  if (params.stage !== linkedStage) {
    setLinkedStage(params.stage);
    if (params.stage === "preuni" || params.stage === "uni") {
      const next = params.stage;
      setView("all");
      setFilters((f) =>
        f.stage === next
          ? f
          : { ...DEFAULT_FILTERS, region: f.region, firm: f.firm, stage: next },
      );
    }
  }

  useEffect(() => {
    const timer = setTimeout(
      () => setFilters((f) => ({ ...f, firm: firmInput })),
      SEARCH_DELAY_MS,
    );
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
          rows:
            nextPage === 0 || current?.filters !== next
              ? rows
              : [...current.rows, ...rows],
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
    if (view !== "all" || !hasMore || loadingMore || openings === null) return;
    setLoadingMore(true);
    await load(filters, page + 1);
    setLoadingMore(false);
  }

  function toggleType(type: OpeningType | PreUniType) {
    setFilters((f) => ({
      ...f,
      types: f.types.includes(type)
        ? f.types.filter((t) => t !== type)
        : [...f.types, type],
    }));
  }

  const starred = useMemo(
    () => upcomingStarred(stars.list ?? [], new Date()),
    [stars.list],
  );
  const data = view === "all" ? (openings ?? []) : starred;
  const filterCount = activeFilterCount(filters);
  const closingThisWeek = starred.filter((o) => {
    if (!o.deadline) return false;
    const left = daysLeft(o.deadline, new Date());
    return left >= 0 && left <= 7;
  }).length;

  const header = (
    <View style={[styles.header, { paddingTop: topInset + Spacing.four }]}>
      <Title eyebrow="Openings" title="Tracker" />

      <Hero style={styles.hero}>
        <View style={styles.heroHead}>
          <Kicker color={onHero.secondary}>Your tracker</Kicker>
          <Text style={styles.heroNote}>
            {stage === "preuni"
              ? `Pre-uni · ${REGION_LABELS[filters.region]}`
              : REGION_LABELS[filters.region]}
          </Text>
        </View>
        <HeroStats
          stats={[
            {
              value: stars.list ? String(starred.length) : "–",
              label: "Starred",
            },
            {
              value: stars.list ? String(closingThisWeek) : "–",
              label: "Close this week",
            },
            {
              value: openings
                ? openings.length >= PAGE_SIZE
                  ? `${openings.length}+`
                  : String(openings.length)
                : "–",
              label: "Shown",
            },
          ]}
        />
      </Hero>

      <View style={[styles.search, { backgroundColor: palette.raised }]}>
        <SymbolView
          name={{ ios: "magnifyingglass", android: "search", web: "search" }}
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
          ["all", "All openings"],
          ["starred", `Starred${stars.list ? ` · ${starred.length}` : ""}`],
        ]}
        value={view}
        onChange={setView}
      />

      {view === "all" ? (
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
            {(["uni", "preuni"] as const).map((option) => (
              <Chip
                key={option}
                label={STAGE_LABELS[option]}
                selected={stage === option}
                onPress={() =>
                  setFilters((f) => ({ ...f, stage: option, types: [] }))
                }
              />
            ))}
          </ChipRow>
          <ChipRow>
            {typesFor(stage).map((type) => (
              <Chip
                key={type}
                label={TYPE_LABELS[type]}
                selected={filters.types.includes(type)}
                onPress={() => toggleType(type)}
              />
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
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() =>
              router.push(
                stage === "preuni"
                  ? "/opening-soon?stage=preuni"
                  : "/opening-soon",
              )
            }
          >
            <Text style={[styles.clear, { color: palette.tint }]}>
              {stage === "preuni"
                ? "When school-age programmes usually open"
                : "See what’s opening soon"}
            </Text>
          </Pressable>
          {filterCount > 0 ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => {
                setFirmInput("");
                setFilters({ ...DEFAULT_FILTERS, stage });
              }}
            >
              <Text style={[styles.clear, { color: palette.tint }]}>
                Clear filters
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {error ? (
        <Text style={[styles.error, { color: palette.danger }]}>{error}</Text>
      ) : null}
    </View>
  );

  const empty =
    view === "starred" ? (
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
      <Empty
        title="Nothing matches"
        body="Try another firm, type or deadline, or clear the filters."
      />
    );

  return (
    <topBar.Provider value={topBar.setTitle}>
      <View style={{ flex: 1, backgroundColor: palette.background }}>
        <Animated.FlatList
          {...topBar.scrollProps}
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
          ListFooterComponent={loadingMore ? <Loading /> : undefined}
          ItemSeparatorComponent={Separator}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={palette.textSecondary}
            />
          }
        />
        {topBar.bar}
      </View>
    </topBar.Provider>
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
      style={styles.chipScroll}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Platform.OS === "web" ? 112 : Spacing.six,
  },
  hero: {
    gap: Spacing.three,
  },
  heroHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroNote: {
    color: onHero.secondary,
    fontSize: 13,
    fontWeight: "600",
  },
  header: {
    gap: Spacing.four,
    paddingBottom: Spacing.four,
  },
  search: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
  },
  clear: {
    fontSize: 14,
    fontWeight: "600",
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
