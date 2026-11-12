import { SymbolView } from 'expo-symbols';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { Button, Card, Chip, Empty, Hero, HeroStats, Kicker, Loading, onHero, Pill, Screen, Title } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useLoad } from '@/hooks/use-load';
import { usePalette } from '@/hooks/use-palette';
import { fetchSavedOpportunityUrls, saveOpportunity, unsaveOpportunity } from '@/lib/applications/queries';
import { openOutside } from '@/lib/open';
import { KINDS, kindLabel, opportunityMeta, type Opportunity, type OpportunityKind } from '@/lib/openings/opportunities';
import { fetchOpportunities } from '@/lib/openings/queries';
import { hideSplash } from '@/lib/splash';
import { REGION_LABELS, REGIONS, type Region } from '@/lib/tracker/openings';

/** Accelerators, fellowships, VC programmes, hackathons and events for student founders. */
export default function OpportunitiesScreen() {
  const palette = usePalette();
  const [region, setRegion] = useState<Region>('uk');
  const [kind, setKind] = useState<OpportunityKind | null>(null);
  const { data, error, refreshing, refresh } = useLoad(() => fetchOpportunities(region), region);
  const saved = useLoad(() => fetchSavedOpportunityUrls().catch(() => new Set<string>()));

  useFocusEffect(useCallback(() => hideSplash(), []));

  const shown = useMemo(() => (data ?? []).filter((row) => !kind || row.kind === kind), [data, kind]);
  const now = useMemo(() => new Date(), [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const closingSoon = (data ?? []).filter((row) => {
    if (!row.deadline) return false;
    const days = (new Date(row.deadline).getTime() - now.getTime()) / 86_400_000;
    return days >= 0 && days <= 14;
  }).length;

  async function toggleSave(row: Opportunity) {
    const urls = saved.data ?? new Set<string>();
    const isSaved = urls.has(row.url);
    const next = new Set(urls);
    if (isSaved) next.delete(row.url);
    else next.add(row.url);
    saved.setData(next);
    try {
      if (isSaved) await unsaveOpportunity(row.url);
      else await saveOpportunity(row);
    } catch (failure) {
      saved.setData(urls);
      Alert.alert('Couldn’t save that', failure instanceof Error ? failure.message : String(failure));
    }
  }

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Title eyebrow="Founders" title="Startup opportunities" />

      <Hero>
        <Kicker color={onHero.secondary}>For student founders</Kicker>
        <Text style={styles.heroBody}>
          Accelerators, fellowships, VC programmes, hackathons and events. Saved ones go to My applications.
        </Text>
        <HeroStats
          stats={[
            { value: data ? String(data.length) : '–', label: 'Open now' },
            { value: data ? String(closingSoon) : '–', label: 'Close in 2 weeks' },
            { value: saved.data ? String(saved.data.size) : '–', label: 'Saved' },
          ]}
        />
      </Hero>

      <View style={styles.filters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {REGIONS.map((option) => (
            <Chip key={option} label={REGION_LABELS[option]} selected={region === option} onPress={() => setRegion(option)} />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <Chip label="All" selected={kind === null} onPress={() => setKind(null)} />
          {KINDS.map((option) => (
            <Chip key={option} label={kindLabel(option)} selected={kind === option} onPress={() => setKind(kind === option ? null : option)} />
          ))}
        </ScrollView>
      </View>

      {error && !data ? (
        <Empty title="Couldn’t load opportunities" body={error} action={<Button variant="secondary" label="Try again" onPress={refresh} />} />
      ) : !data ? (
        <Loading />
      ) : shown.length === 0 ? (
        <Empty title="Nothing here right now" body="Try another region or kind. New ones are added every day." />
      ) : (
        shown.map((row) => {
          const isSaved = saved.data?.has(row.url) ?? false;
          return (
            <Card key={row.id} style={styles.card} onPress={() => void openOutside(row.url, 'browser')} accessibilityLabel={row.name}>
              <View style={styles.head}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.organiser, { color: palette.textSecondary }]} numberOfLines={1}>
                    {row.organiser}
                  </Text>
                  <Text style={[styles.name, { color: palette.text }]} numberOfLines={2}>
                    {row.name}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={isSaved ? `Remove ${row.name} from your tracker` : `Save ${row.name}`}
                  accessibilityState={{ selected: isSaved }}
                  hitSlop={10}
                  onPress={() => void toggleSave(row)}>
                  <SymbolView
                    name={
                      isSaved
                        ? { ios: 'bookmark.fill', android: 'bookmark', web: 'bookmark' }
                        : { ios: 'bookmark', android: 'bookmark_border', web: 'bookmark_border' }
                    }
                    tintColor={isSaved ? palette.tint : palette.faint}
                    size={22}
                  />
                </Pressable>
              </View>
              {row.description ? (
                <Text style={[styles.description, { color: palette.textSecondary }]} numberOfLines={3}>
                  {row.description}
                </Text>
              ) : null}
              <View style={styles.footer}>
                <Pill label={kindLabel(row.kind)} tone="green" />
                <Text style={[styles.meta, { color: palette.textSecondary }]} numberOfLines={1}>
                  {opportunityMeta(row)}
                </Text>
              </View>
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroBody: {
    color: onHero.secondary,
    fontSize: 15,
    lineHeight: 21,
  },
  filters: {
    gap: Spacing.two,
    marginHorizontal: -Spacing.four,
  },
  chipRow: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: 2,
  },
  card: {
    gap: Spacing.three,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  organiser: {
    fontSize: 13,
    fontWeight: '600',
  },
  name: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginTop: 2,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  meta: {
    flex: 1,
    fontSize: 13,
  },
});
