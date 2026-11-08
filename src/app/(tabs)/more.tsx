import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { Fragment } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { IconTile, Wordmark } from '@/components/ui';
import { cardShadow, Radius, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { openOutside, shareLink } from '@/lib/open';
import { signOut } from '@/lib/session';
import { SITE_ORIGIN } from '@/lib/site';
import { hideSplash } from '@/lib/splash';

type Item = {
  label: string;
  icon: { ios: SFSymbol; android: AndroidSymbol };
} & ({ path: string } | { onPress: () => void });

type Section = { title: string; items: Item[] };

const SECTIONS: Section[] = [
  {
    title: 'Applications',
    items: [
      { label: 'My applications', path: '/dashboard/applications', icon: { ios: 'checklist', android: 'checklist' } },
      { label: 'Opening soon', path: '/expected-openings', icon: { ios: 'calendar.badge.clock', android: 'event_upcoming' } },
      { label: 'Live feed', path: '/live', icon: { ios: 'dot.radiowaves.left.and.right', android: 'sensors' } },
      { label: 'Startup opportunities', path: '/opportunities', icon: { ios: 'lightbulb', android: 'lightbulb' } },
      { label: 'Pre-uni tracker', path: '/pre-uni-tracker', icon: { ios: 'graduationcap', android: 'school' } },
      { label: 'Submit an opening', path: '/submit-opening', icon: { ios: 'plus.circle', android: 'add_circle' } },
    ],
  },
  {
    title: 'AI tools',
    items: [
      { label: 'CV rater', path: '/cv-rater', icon: { ios: 'doc.text.magnifyingglass', android: 'description' } },
      { label: 'Cover letter', path: '/cover-letter', icon: { ios: 'envelope.open', android: 'drafts' } },
      { label: 'Firm prep', path: '/interview-prep', icon: { ios: 'building.columns', android: 'account_balance' } },
      { label: 'Mock interview', path: '/mock-interview', icon: { ios: 'video', android: 'videocam' } },
      { label: 'Personal statement builder', path: '/ps-builder', icon: { ios: 'pencil.line', android: 'edit_note' } },
      { label: 'Study coach', path: '/study-coach', icon: { ios: 'book', android: 'menu_book' } },
    ],
  },
  {
    title: 'Practice',
    items: [
      { label: 'Drills', onPress: () => router.push('/drills'), icon: { ios: 'stopwatch', android: 'timer' } },
      { label: 'My progress', path: '/progress', icon: { ios: 'chart.line.uptrend.xyaxis', android: 'trending_up' } },
      { label: '1v1 challenge', path: '/1v1', icon: { ios: 'person.2.wave.2', android: 'sports_kabaddi' } },
      { label: 'Online assessment prep', path: '/oa-prep', icon: { ios: 'puzzlepiece', android: 'extension' } },
      { label: 'Interview course', path: '/interview-course', icon: { ios: 'list.bullet.rectangle', android: 'quiz' } },
    ],
  },
  {
    title: 'Mentoring and guides',
    items: [
      { label: '1:1 mentoring', path: '/', icon: { ios: 'person.2', android: 'group' } },
      { label: 'Spring Week Playbook', path: '/spring-week-playbook', icon: { ios: 'book.closed', android: 'auto_stories' } },
      { label: 'Resources', path: '/resources', icon: { ios: 'tray.and.arrow.down', android: 'download' } },
      { label: 'WhatsApp community', path: '/whatsapp', icon: { ios: 'bubble.left.and.bubble.right', android: 'forum' } },
      { label: 'Pricing', path: '/pricing', icon: { ios: 'tag', android: 'sell' } },
    ],
  },
  {
    title: 'App',
    items: [
      // Also where the account can be deleted, which App Review checks for.
      { label: 'Account settings', path: '/dashboard/settings', icon: { ios: 'person.crop.circle', android: 'account_circle' } },
      {
        label: 'Share simplytk',
        onPress: () => void shareLink({ title: 'simplytk', url: SITE_ORIGIN }),
        icon: { ios: 'square.and.arrow.up', android: 'share' },
      },
      {
        label: 'Open simplytk.com in browser',
        onPress: () => void openOutside(SITE_ORIGIN, 'browser'),
        icon: { ios: 'safari', android: 'open_in_browser' },
      },
      { label: 'Leave a review', path: '/leave-a-review', icon: { ios: 'star', android: 'star' } },
      { label: 'Privacy', path: '/privacy', icon: { ios: 'hand.raised', android: 'privacy_tip' } },
      { label: 'Terms', path: '/terms', icon: { ios: 'doc.plaintext', android: 'gavel' } },
      {
        label: 'Sign out',
        onPress: () =>
          Alert.alert('Sign out?', 'Alerts stop on this phone until you sign in again.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
          ]),
        icon: { ios: 'rectangle.portrait.and.arrow.right', android: 'logout' },
      },
    ],
  },
];

function open(item: Item) {
  if ('onPress' in item) {
    item.onPress();
  } else {
    router.push({ pathname: '/page', params: { path: item.path, title: item.label } });
  }
}

export default function MoreScreen() {
  const palette = usePalette();
  const version = Constants.expoConfig?.version ?? '';
  const insets = useSafeAreaInsets();
  // iOS insets the scroll view automatically; Android tabs only handle the bottom edge.
  const topInset = Platform.OS === 'android' ? insets.top : 0;

  // Opened straight from a simplytk://more link there's no page load to wait for. (Tabs
  // mount eagerly, so this has to wait for focus rather than mount.)
  useFocusEffect(hideSplash);

  return (
    <ScrollView
      style={{ backgroundColor: palette.background }}
      contentContainerStyle={[styles.content, { paddingTop: topInset + Spacing.four }]}
      contentInsetAdjustmentBehavior="automatic">
      <View style={styles.header}>
        <Wordmark size={26} />
        <Text style={[styles.tagline, { color: palette.textSecondary }]}>Find the role. Win the offer.</Text>
      </View>

      {SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: palette.textSecondary }]}>
            {section.title.toUpperCase()}
          </Text>
          <View
            style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }, cardShadow(palette.shadow)]}>
            {section.items.map((item, index) => (
              <Fragment key={item.label}>
                {index > 0 && (
                  <View style={[styles.separator, { backgroundColor: palette.border }]} />
                )}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => open(item)}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && { backgroundColor: palette.muted },
                  ]}>
                  <IconTile icon={item.icon} />
                  <Text style={[styles.label, { color: palette.text, fontWeight: '500' }]}>{item.label}</Text>
                  {'path' in item && (
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

      <Text style={[styles.footer, { color: palette.textSecondary }]}>
        simplytk for {Platform.OS === 'ios' ? 'iOS' : 'Android'} · version {version}
      </Text>
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
    gap: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  tagline: {
    fontSize: 15,
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
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  label: {
    flex: 1,
    fontSize: 16,
  },
  separator: {
    height: 1,
    marginLeft: Spacing.four + 36 + Spacing.three,
  },
  footer: {
    fontSize: 13,
    textAlign: 'center',
  },
});
