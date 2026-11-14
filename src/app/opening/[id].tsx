import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { StarButton } from '@/components/opening-card';
import { StageSheet } from '@/components/stage-sheet';
import { Text } from '@/components/text';
import { Button, Card, Empty, Kicker, Loading, Screen } from '@/components/ui';
import { Spacing, Tabular } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { fetchApplicationForJob, setStage, trackOpening, type Application } from '@/lib/applications/queries';
import { STAGE_LABELS, stageOf, type ApplicationStage } from '@/lib/applications/stages';
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
  // The student's row in their application tracker: undefined while loading, null if none.
  const [application, setApplication] = useState<Application | null | undefined>(undefined);
  const [picking, setPicking] = useState(false);

  useEffect(hideSplash, []);

  const loadApplication = useCallback(() => {
    fetchApplicationForJob(id).then(setApplication, () => setApplication(null));
  }, [id]);
  useEffect(loadApplication, [loadApplication]);

  async function pick(stage: ApplicationStage) {
    setPicking(false);
    try {
      if (application) await setStage(application, stage);
      else await trackOpening(id, stage);
      loadApplication();
    } catch (failure) {
      Alert.alert('Couldn’t save that', failure instanceof Error ? failure.message : String(failure));
    }
  }

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
            label={application ? `In your tracker: ${STAGE_LABELS[stageOf(application)]}` : 'Track application'}
            icon={application ? { ios: 'checklist.checked', android: 'checklist' } : { ios: 'plus', android: 'add' }}
            disabled={application === undefined}
            onPress={() => setPicking(true)}
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

        <StageSheet
          visible={picking}
          title={opening.companies?.name ?? 'Opening'}
          subtitle={opening.title}
          current={application ? stageOf(application) : null}
          onPick={(stage) => void pick(stage)}
          onClose={() => setPicking(false)}
        />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  head: {
    gap: Spacing.two,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700',
    letterSpacing: -0.6,
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
