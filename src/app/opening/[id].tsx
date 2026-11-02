import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { StarButton } from '@/components/opening-card';
import { Button, Card, Empty, Kicker, Loading, Screen } from '@/components/ui';
import { Spacing, Tabular } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { openOutside, shareLink } from '@/lib/open';
import { SITE_ORIGIN } from '@/lib/site';
import { hideSplash } from '@/lib/splash';
import { deadlineLabel, formatDate, typeLabel } from '@/lib/tracker/openings';
import { fetchOpening, type Opening } from '@/lib/tracker/queries';

function slugPart(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}

/** The opening's page on simplytk.com, for sharing (src/lib/opening-slug.ts there). */
function openingUrl(opening: Opening) {
  const readable = [opening.companies?.slug ?? 'opening', slugPart(opening.title)].filter(Boolean).join('-');
  return `${SITE_ORIGIN}/openings/${readable}-${opening.id}`;
}

/** One opening, with its apply link. Where a tapped alert lands. */
export default function OpeningScreen() {
  const palette = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [opening, setOpening] = useState<Opening | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(hideSplash, []);

  useEffect(() => {
    let live = true;
    fetchOpening(id)
      .then((row) => live && setOpening(row))
      .catch((failure) => {
        if (!live) return;
        setError(failure instanceof Error ? failure.message : String(failure));
        setOpening(null);
      });
    return () => {
      live = false;
    };
  }, [id]);

  if (opening === undefined) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  if (opening === null) {
    return (
      <Screen>
        <Empty title="Opening not found" body={error ?? 'It may have been taken down by the firm.'} />
      </Screen>
    );
  }

  const now = new Date();
  const deadline = deadlineLabel(opening.deadline, now);
  const open = opening.status === 'open';
  const facts: [string, string][] = [
    ['Type', typeLabel(opening.programme_type)],
    ['Location', opening.location ?? ''],
    ['Deadline', opening.deadline ? formatDate(opening.deadline) : 'Rolling'],
    ['Cover letter', opening.cover_letter_required == null ? '' : opening.cover_letter_required ? 'Required' : 'Not required'],
    ['Visa sponsorship', opening.visa_sponsorship == null ? '' : opening.visa_sponsorship ? 'Yes' : 'No'],
  ].filter((fact): fact is [string, string] => !!fact[1]);

  return (
    <>
      <Stack.Screen options={{ title: opening.companies?.name ?? '', headerRight: () => <StarButton opening={opening} /> }} />
      <Screen>
        <View style={styles.head}>
          <Kicker>{opening.companies?.name ?? 'Opening'}</Kicker>
          <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>
            {opening.title}
          </Text>
          <Text
            style={[
              styles.deadline,
              Tabular,
              { color: deadline.tone === 'urgent' ? palette.danger : deadline.tone === 'soon' ? palette.warning : palette.textSecondary },
            ]}>
            {open ? deadline.text : 'This opening has closed'}
          </Text>
        </View>

        <View style={styles.actions}>
          <Button
            label={open ? 'Apply on the firm’s site' : 'View the listing'}
            icon={{ ios: 'arrow.up.right', android: 'open_in_new' }}
            onPress={() => void openOutside(opening.apply_url, 'browser')}
          />
          <Button
            variant="secondary"
            label="Share"
            icon={{ ios: 'square.and.arrow.up', android: 'share' }}
            onPress={() => void shareLink({ title: `${opening.companies?.name ?? ''} ${opening.title}`.trim(), url: openingUrl(opening) })}
          />
        </View>

        <Card style={styles.facts}>
          {facts.map(([label, value], index) => (
            <View key={label} style={[styles.fact, index > 0 && { borderTopColor: palette.hair, borderTopWidth: 1 }]}>
              <Text style={[styles.factLabel, { color: palette.textSecondary }]}>{label}</Text>
              <Text style={[styles.factValue, { color: palette.text }]}>{value}</Text>
            </View>
          ))}
        </Card>

        <Text style={[styles.note, { color: palette.textSecondary }]}>
          Starred openings get a notification a week before the deadline, two days before and on the day.
        </Text>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  head: {
    gap: Spacing.two,
  },
  title: {
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '600',
    letterSpacing: -0.8,
  },
  deadline: {
    fontSize: 15,
    fontWeight: '600',
  },
  actions: {
    gap: Spacing.three,
  },
  facts: {
    paddingVertical: Spacing.one,
    gap: 0,
  },
  fact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
    gap: Spacing.four,
  },
  factLabel: {
    fontSize: 15,
  },
  factValue: {
    fontSize: 15,
    fontWeight: '500',
    flexShrink: 1,
    textAlign: 'right',
  },
  note: {
    fontSize: 13,
    lineHeight: 19,
  },
});
