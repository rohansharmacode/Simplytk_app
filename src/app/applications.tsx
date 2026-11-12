import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { FirmLogo } from '@/components/opening-card';
import { StageSheet } from '@/components/stage-sheet';
import { Text } from '@/components/text';
import { Button, Empty, Group, Hero, HeroStats, Kicker, Loading, onHero, Row, Screen, SectionHeader, Title } from '@/components/ui';
import { usePalette } from '@/hooks/use-palette';
import { useLoad } from '@/hooks/use-load';
import { describe, fetchApplications, removeApplication, setStage, type Application } from '@/lib/applications/queries';
import { funnel, groupByStage, STAGE_LABELS, STAGE_TONES, stageOf, type ApplicationStage } from '@/lib/applications/stages';
import { openOutside } from '@/lib/open';
import { hideSplash } from '@/lib/splash';
import { deadlineLabel } from '@/lib/tracker/openings';

const SECTION_ICONS = {
  to_apply: { ios: 'square.and.pencil', android: 'edit' },
  applied: { ios: 'paperplane.fill', android: 'send' },
  in_progress: { ios: 'person.2.fill', android: 'groups' },
  offer: { ios: 'checkmark.seal.fill', android: 'verified' },
  rejected: { ios: 'xmark.circle.fill', android: 'cancel' },
} as const;

/** The student's application tracker, the same rows as simplytk.com/dashboard/applications. */
export default function ApplicationsScreen() {
  const palette = usePalette();
  const router = useRouter();
  const { data, error, refreshing, refresh, reload, setData } = useLoad(fetchApplications);
  const [editing, setEditing] = useState<Application | null>(null);

  useFocusEffect(
    useCallback(() => {
      hideSplash();
      void reload();
    }, [reload]),
  );

  async function pick(application: Application, stage: ApplicationStage) {
    setEditing(null);
    const before = data;
    // Show the move straight away; put it back if the save fails.
    setData((rows) =>
      rows?.map((row) =>
        row.id === application.id
          ? { ...row, status: stage.replace('_done', ''), stage_completed_at: stage.endsWith('_done') ? new Date().toISOString() : null }
          : row,
      ),
    );
    try {
      await setStage(application, stage);
      void reload();
    } catch (failure) {
      setData(before);
      Alert.alert('Couldn’t save that', failure instanceof Error ? failure.message : String(failure));
    }
  }

  function remove(application: Application) {
    setEditing(null);
    Alert.alert('Remove from your tracker?', describe(application).firm, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const before = data;
          setData((rows) => rows?.filter((row) => row.id !== application.id));
          try {
            await removeApplication(application.id);
          } catch (failure) {
            setData(before);
            Alert.alert('Couldn’t remove it', failure instanceof Error ? failure.message : String(failure));
          }
        },
      },
    ]);
  }

  const now = new Date();
  const counts = data ? funnel(data) : null;
  const sections = data ? groupByStage(data) : [];
  const editingInfo = editing ? describe(editing) : null;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Title eyebrow="Applications" title="My applications" />

      <Hero>
        <Kicker color={onHero.secondary}>This cycle</Kicker>
        <Text style={styles.heroBody}>
          Everything you’re applying to, in one place. It’s the same list as on simplytk.com.
        </Text>
        <HeroStats
          stats={[
            { value: counts ? String(counts.tracked) : '–', label: 'Tracked' },
            { value: counts ? String(counts.applied) : '–', label: 'Applied' },
            { value: counts ? String(counts.interviews) : '–', label: 'Interviews' },
            { value: counts ? String(counts.offers) : '–', label: 'Offers' },
          ]}
        />
      </Hero>

      {error && !data ? (
        <Empty title="Couldn’t load your applications" body={error} action={<Button variant="secondary" label="Try again" onPress={refresh} />} />
      ) : !data ? (
        <Loading />
      ) : data.length === 0 ? (
        <Empty
          title="Nothing tracked yet"
          body="Open an opening in the Tracker and tap Track application. It shows here and on the website."
          action={<Button variant="secondary" label="Browse the tracker" onPress={() => router.navigate('/tracker')} />}
        />
      ) : (
        sections.map((section) => (
          <View key={section.key} style={styles.section}>
            <SectionHeader
              title={section.title}
              icon={SECTION_ICONS[section.key]}
              tone={STAGE_TONES[stageOf(section.rows[0])]}
              count={section.rows.length}
            />
            <Group>
              {section.rows.map((application) => {
                const info = describe(application);
                const stage = stageOf(application);
                const deadline =
                  stage === 'not_started' && application.jobs?.deadline ? deadlineLabel(application.jobs.deadline, now).text : null;
                return (
                  <Row
                    key={application.id}
                    leading={
                      <FirmLogo
                        size={36}
                        opening={{ companies: application.jobs?.companies ?? { name: info.firm, logo_url: null } }}
                      />
                    }
                    title={info.firm}
                    subtitle={[info.title, deadline].filter(Boolean).join(' · ')}
                    pill={{ label: STAGE_LABELS[stage], tone: STAGE_TONES[stage] }}
                    onPress={() => setEditing(application)}
                  />
                );
              })}
            </Group>
          </View>
        ))
      )}

      {error && data ? <Text style={[styles.error, { color: palette.danger }]}>{error}</Text> : null}

      <StageSheet
        visible={!!editing}
        title={editingInfo?.firm ?? ''}
        subtitle={editingInfo?.title}
        current={editing ? stageOf(editing) : null}
        onPick={(stage) => editing && void pick(editing, stage)}
        onClose={() => setEditing(null)}
        actions={[
          ...(editing?.job_id
            ? [
                {
                  label: 'See the opening',
                  onPress: () => {
                    const id = editing.job_id!;
                    setEditing(null);
                    router.push({ pathname: '/opening/[id]', params: { id } });
                  },
                },
              ]
            : []),
          ...(editingInfo?.url
            ? [{ label: 'Open the application page', onPress: () => void openOutside(editingInfo.url!, 'browser') }]
            : []),
          ...(editing ? [{ label: 'Remove from tracker', destructive: true, onPress: () => remove(editing) }] : []),
        ]}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroBody: {
    color: onHero.secondary,
    fontSize: 15,
    lineHeight: 21,
  },
  section: {
    gap: 12,
  },
  error: {
    fontSize: 13,
  },
});
