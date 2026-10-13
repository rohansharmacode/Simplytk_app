import { router, useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Fragment } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { DRILL_GROUPS, type Drill } from '@/lib/drills/catalogue';
import { hideSplash } from '@/lib/splash';

type Row = { title: string; blurb: string; slug: string; native?: true };

/** Site pages that sit alongside the drills on simplytk.com/oa-prep. */
const MORE_PRACTICE: Row[] = [
  { slug: 'oa-prep', title: 'Which test does my firm send?', blurb: 'Pick a firm and see the drills that train its test.' },
  { slug: 'oa-leaderboard', title: 'Overall leaderboard', blurb: 'The combined board across every ranked drill.' },
  { slug: '1v1', title: '1v1 challenge', blurb: 'Same drill, same questions, same clock as a friend.' },
  { slug: 'practice', title: 'Practice questions', blurb: 'Finance and brainteaser questions with instant feedback.' },
];

function open(row: Row | Drill) {
  if (row.native) {
    router.push({ pathname: '/play/[slug]', params: { slug: row.slug } });
  } else {
    router.push({ pathname: '/page', params: { path: `/${row.slug}`, title: row.title } });
  }
}

export default function DrillsScreen() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  // iOS insets the scroll view automatically; Android tabs only handle the bottom edge.
  const topInset = Platform.OS === 'android' ? insets.top : 0;

  // Opened straight from a simplytk://drills link there's no page load to wait for.
  useFocusEffect(hideSplash);

  const sections = [...DRILL_GROUPS, { title: 'More practice', drills: MORE_PRACTICE }];

  return (
    <ScrollView
      style={{ backgroundColor: palette.background }}
      contentContainerStyle={[styles.content, { paddingTop: topInset + Spacing.four }]}
      contentInsetAdjustmentBehavior="automatic">
      <View style={styles.header}>
        <Text style={[styles.title, { color: palette.text }]} accessibilityRole="header">
          Drills
        </Text>
        <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
          The tests firms actually set, on repeat. Drills marked Play run right here in the app.
        </Text>
      </View>

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.five,
  },
  header: {
    gap: Spacing.one,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 20,
  },
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
