import { router, useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Fragment } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { Screen, Title } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { DRILL_GROUPS, type Drill } from '@/lib/drills/catalogue';
import { hideSplash } from '@/lib/splash';
import { openSitePath } from '@/lib/web-pages';

type Row = { title: string; blurb: string; slug: string; native?: true };

/** Pages that sit alongside the drills on simplytk.com/oa-prep; most have a native screen. */
const MORE_PRACTICE: Row[] = [
  { slug: 'oa-prep', title: 'Which test does my firm send?', blurb: 'Pick a firm and see the drills that train its test.' },
  { slug: 'oa-leaderboard', title: 'Overall leaderboard', blurb: 'The combined board across every ranked drill.' },
  { slug: '1v1', title: '1v1 challenge', blurb: 'Same drill, same questions, same clock as a friend.' },
  { slug: 'interview-course', title: 'Interview course', blurb: 'Real interview questions, marked by an AI tutor.' },
  { slug: 'practice', title: 'Practice questions', blurb: 'Finance and brainteaser questions with instant feedback.' },
];

function open(row: Row | Drill) {
  if (row.native) {
    router.push({ pathname: '/play/[slug]', params: { slug: row.slug } });
  } else {
    openSitePath(`/${row.slug}`, row.title);
  }
}

export default function DrillsScreen() {
  const palette = usePalette();

  // Opened straight from a simplytk://drills link there's no page load to wait for.
  useFocusEffect(hideSplash);

  const sections = [...DRILL_GROUPS, { title: 'More practice', drills: MORE_PRACTICE }];

  return (
    <Screen>
      <Title
        eyebrow="Practice"
        title="Drills"
        subtitle="The tests firms actually set, on repeat. Drills marked Play run right here in the app."
      />

      {sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: palette.textSecondary }]}>
            {section.title.toUpperCase()}
          </Text>
          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            {section.drills.map((row, index) => (
              <Fragment key={row.slug}>
                {index > 0 && <View style={[styles.separator, { backgroundColor: palette.border }]} />}
                <Pressable
                  accessibilityRole="button"
                  accessibilityHint={row.native ? 'Plays in the app' : 'Opens on simplytk.com'}
                  onPress={() => open(row)}
                  style={({ pressed }) => [styles.row, pressed && { backgroundColor: palette.muted }]}>
                  <View style={styles.rowText}>
                    <Text style={[styles.label, { color: palette.text }]}>{row.title}</Text>
                    <Text style={[styles.blurb, { color: palette.textSecondary }]} numberOfLines={2}>
                      {row.blurb}
                    </Text>
                  </View>
                  {row.native ? (
                    <View style={[styles.badge, { backgroundColor: palette.tint }]}>
                      <Text style={[styles.badgeLabel, { color: palette.onTint }]}>Play</Text>
                    </View>
                  ) : (
                    <SymbolView
                      name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                      tintColor={palette.textSecondary}
                      size={14}
                    />
                  )}
                </Pressable>
              </Fragment>
            ))}
          </View>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
    marginLeft: Spacing.four,
  },
  card: {
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    gap: Spacing.three,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
  },
  blurb: {
    fontSize: 13,
    lineHeight: 18,
  },
  badge: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
  },
  badgeLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: Spacing.four,
  },
});
