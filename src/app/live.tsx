import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { OpeningCard } from '@/components/opening-card';
import { Text } from '@/components/text';
import { Button, Empty, Hero, HeroStats, Kicker, Loading, onHero, Screen, SectionHeader, Title } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useLoad } from '@/hooks/use-load';
import { detectedAt, groupByDay, isNew } from '@/lib/openings/live';
import { fetchLiveFeed } from '@/lib/openings/queries';
import { hideSplash } from '@/lib/splash';

/** Checked again this often while the screen is showing, as the website's feed does. */
const REFRESH_MS = 60_000;

/** Every opening the moment the website's scrapers detect it, newest first. */
export default function LiveScreen() {
  const { data, error, refreshing, refresh, reload } = useLoad(fetchLiveFeed);

  useFocusEffect(
    useCallback(() => {
      hideSplash();
      const timer = setInterval(() => void reload(), REFRESH_MS);
      return () => clearInterval(timer);
    }, [reload]),
  );

  const now = useMemo(() => new Date(), [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const groups = data ? groupByDay(data, now) : [];
  const today = data?.filter((row) => row.first_seen_at && isNew(row.first_seen_at, now)).length;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Title eyebrow="Live" title="Live feed" />

      <Hero>
        <View style={styles.live}>
          <View style={styles.dot} />
          <Kicker color={onHero.secondary}>Live · refreshes every minute</Kicker>
        </View>
        <Text style={styles.heroBody}>Every opening the moment our scrapers spot it, newest first.</Text>
        <HeroStats
          stats={[
            { value: today == null ? '–' : String(today), label: 'In the last day' },
            {
              value: data ? now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '–',
              label: 'Last checked',
            },
          ]}
        />
      </Hero>

      {error && !data ? (
        <Empty title="Couldn’t load the feed" body={error} action={<Button variant="secondary" label="Try again" onPress={refresh} />} />
      ) : !data ? (
        <Loading />
      ) : groups.length === 0 ? (
        <Empty title="Nothing detected yet" body="The scrapers run every few minutes. Check back shortly." />
      ) : (
        groups.map((group) => (
          <View key={group.label} style={styles.section}>
            <SectionHeader title={group.label} count={group.rows.length} />
            {group.rows.map((opening) => (
              <OpeningCard
                key={opening.id}
                opening={opening}
                now={now}
                note={{
                  text: `Detected ${detectedAt(opening.first_seen_at!)}${isNew(opening.first_seen_at!, now) ? ' · New' : ''}`,
                  fresh: isNew(opening.first_seen_at!, now),
                }}
              />
            ))}
          </View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  live: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34D399',
  },
  heroBody: {
    color: onHero.secondary,
    fontSize: 15,
    lineHeight: 21,
  },
  section: {
    gap: Spacing.three,
  },
});
