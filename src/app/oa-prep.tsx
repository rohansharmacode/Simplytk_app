import { SymbolView } from 'expo-symbols';
import { useFocusEffect } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { LoadState } from '@/components/load-state';
import { Text, TextInput } from '@/components/text';
import { Card, Hero, HeroStats, Kicker, onHero, Pill, Screen, Segmented, Title } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useLoad } from '@/hooks/use-load';
import { usePalette } from '@/hooks/use-palette';
import { getOaPrep, type GameLink } from '@/lib/site-api';
import { hideSplash } from '@/lib/splash';
import { openSitePath } from '@/lib/web-pages';

type Tab = 'firms' | 'providers' | 'tests' | 'plan';

/** Every word typed has to appear somewhere in the text. */
function matches(text: string, query: string) {
  const haystack = text.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

/** Which online test each firm sends, who builds it, and the drills that train it. */
export default function OaPrepScreen() {
  const palette = usePalette();
  const { data, error, missing, refreshing, refresh } = useLoad(getOaPrep);
  const [tab, setTab] = useState<Tab>('firms');
  const [query, setQuery] = useState('');

  useFocusEffect(hideSplash);

  const firms = useMemo(
    () => (data?.firms ?? []).filter((row) => matches(`${row.firm} ${row.provider} ${row.sends}`, query)),
    [data, query],
  );
  const providers = useMemo(
    () => (data?.providers ?? []).filter((row) => matches(`${row.provider} ${row.alsoCalled} ${row.firms}`, query)),
    [data, query],
  );
  const tests = useMemo(
    () => (data?.assessments ?? []).filter((row) => matches(`${row.name} ${row.provider} ${row.format}`, query)),
    [data, query],
  );

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Title eyebrow="Practice" title="Online assessment prep" />

      <Hero>
        <Kicker color={onHero.secondary}>What the firms send</Kicker>
        <Text style={styles.heroBody}>
          Pick your firm to see the test it sends, who builds it, and the drills that train it, in the order to play them.
        </Text>
        <HeroStats
          stats={[
            { value: data ? String(data.firms.length) : '–', label: 'Firms' },
            { value: data ? String(data.providers.length) : '–', label: 'Providers' },
            { value: data ? String(data.firms.filter((f) => f.reported).length) : '–', label: 'With reports' },
          ]}
        />
      </Hero>

      <LoadState
        loaded={!!data}
        error={error}
        missing={missing}
        retry={refresh}
        web={{ path: '/oa-prep', title: 'Online assessment prep' }}
      />

      {data ? (
        <>
          <Segmented
            options={[
              ['firms', 'Firms'],
              ['providers', 'Providers'],
              ['tests', 'Tests'],
              ['plan', 'Plan'],
            ]}
            value={tab}
            onChange={setTab}
          />

          {tab !== 'plan' ? (
            <View style={[styles.search, { backgroundColor: palette.raised }]}>
              <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} tintColor={palette.faint} size={17} />
              <TextInput
                accessibilityLabel="Search"
                placeholder={tab === 'firms' ? 'Search your firm' : tab === 'providers' ? 'Search a provider' : 'Search a test'}
                placeholderTextColor={palette.faint}
                autoCorrect={false}
                clearButtonMode="while-editing"
                value={query}
                onChangeText={setQuery}
                style={[styles.searchInput, { color: palette.text }]}
              />
            </View>
          ) : null}

          {tab === 'firms'
            ? firms.map((row) => (
                <Card key={row.firm} style={styles.card}>
                  <View style={styles.head}>
                    <Text style={[styles.name, { color: palette.text }]}>{row.firm}</Text>
                    <Pill label={row.provider} tone="blue" />
                  </View>
                  <Text style={[styles.body, { color: palette.textSecondary }]}>{row.sends}</Text>
                  {row.reported ? (
                    <Text style={[styles.reported, { color: palette.success }]}>
                      {`Students reported this cycle: ${row.reported.line}`}
                    </Text>
                  ) : null}
                  <Games games={row.games} />
                </Card>
              ))
            : null}

          {tab === 'providers'
            ? providers.map((row) => (
                <Card key={row.provider} style={styles.card}>
                  <Text style={[styles.name, { color: palette.text }]}>{row.provider}</Text>
                  {row.alsoCalled ? (
                    <Text style={[styles.body, { color: palette.textSecondary }]}>{`Also called ${row.alsoCalled}`}</Text>
                  ) : null}
                  <Text style={[styles.body, { color: palette.text }]}>{`Sent by ${row.firms}`}</Text>
                  <Games games={row.games} />
                </Card>
              ))
            : null}

          {tab === 'tests'
            ? tests.map((row) => (
                <Card key={row.name} style={styles.card}>
                  <View style={styles.head}>
                    <Text style={[styles.name, { color: palette.text }]}>{row.name}</Text>
                    <Pill label={row.provider} tone="blue" />
                  </View>
                  <Text style={[styles.body, { color: palette.text }]}>{row.format}</Text>
                  <Fact label="Length and marking" value={row.timing} />
                  <Fact label="What we can’t confirm" value={row.caveat} />
                  <Fact label="Closest practice here" value={row.practise} />
                  {row.to && row.toLabel ? <Games games={[{ label: `Play ${row.toLabel}`, to: row.to }]} /> : null}
                </Card>
              ))
            : null}

          {tab === 'plan'
            ? data.plan.map((step) => (
                <Card key={step.when} style={styles.card}>
                  <Kicker color={palette.tint}>{step.when}</Kicker>
                  <Text style={[styles.name, { color: palette.text }]}>{step.title}</Text>
                  <Text style={[styles.body, { color: palette.textSecondary }]}>{step.body}</Text>
                </Card>
              ))
            : null}

          {(tab === 'firms' && firms.length === 0) ||
          (tab === 'providers' && providers.length === 0) ||
          (tab === 'tests' && tests.length === 0) ? (
            <Text style={[styles.body, { color: palette.textSecondary }]}>Nothing matches that search.</Text>
          ) : null}

          <Text style={[styles.disclaimer, { color: palette.faint }]}>
            The tests are described from public sources, not reproduced. Every drill is a practice format written by
            simplytk, not a real assessment, and simplytk isn’t connected to any firm or test provider.
          </Text>
        </>
      ) : null}
    </Screen>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  const palette = usePalette();
  return (
    <View style={styles.fact}>
      <Kicker>{label}</Kicker>
      <Text style={[styles.body, { color: palette.textSecondary }]}>{value}</Text>
    </View>
  );
}

/** The drills that train a test, as tappable pills: native ones play in the app. */
function Games({ games }: { games: GameLink[] }) {
  const palette = usePalette();
  if (!games.length) return null;
  return (
    <View style={styles.games}>
      {games.map((game, index) => (
        <Pressable
          key={`${game.to}-${index}`}
          accessibilityRole="button"
          onPress={() => openSitePath(game.to, game.label)}
          style={({ pressed }) => [styles.game, { backgroundColor: palette.tintSoft }, pressed && { opacity: 0.6 }]}>
          <Text style={[styles.gameLabel, { color: palette.tint }]}>{`${index + 1}. ${game.label}`}</Text>
        </Pressable>
      ))}
    </View>
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
  card: {
    gap: Spacing.two,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  name: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
  reported: {
    fontSize: 13,
    fontWeight: '600',
  },
  fact: {
    gap: 2,
  },
  games: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  game: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  gameLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  disclaimer: {
    fontSize: 12,
    lineHeight: 17,
  },
});
