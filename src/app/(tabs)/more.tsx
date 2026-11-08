import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';
import { type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { Alert, Platform, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { Group, Hero, onHero, Row, Screen, Title, Wordmark } from '@/components/ui';
import { Spacing, type Tone } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { openOutside, shareLink } from '@/lib/open';
import { signOut, useSession } from '@/lib/session';
import { SITE_ORIGIN } from '@/lib/site';
import { hideSplash } from '@/lib/splash';

type Item = {
  label: string;
  icon: { ios: SFSymbol; android: AndroidSymbol };
} & ({ path: string } | { onPress: () => void });

type Section = { title: string; tone: Tone; items: Item[] };

const SECTIONS: Section[] = [
  {
    title: 'Applications',
    tone: 'blue',
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
    tone: 'purple',
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
    tone: 'green',
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
    tone: 'amber',
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
    tone: 'blue',
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
  const session = useSession();
  const version = Constants.expoConfig?.version ?? '';

  // Opened straight from a simplytk://more link there's no page load to wait for. (Tabs
  // mount eagerly, so this has to wait for focus rather than mount.)
  useFocusEffect(hideSplash);

  const name = (session?.user.user_metadata?.full_name as string | undefined) ?? 'Your account';
  const contact = session?.user.email ?? session?.user.phone ?? '';
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <Screen>
      <Title eyebrow="simplytk" title="More" />

      <Hero style={styles.profile}>
        <View style={styles.profileRow}>
          <View style={[styles.avatar, { borderColor: onHero.line }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.profileText}>
            <Text style={styles.profileName} numberOfLines={1}>
              {name}
            </Text>
            {contact ? (
              <Text style={styles.profileContact} numberOfLines={1}>
                {contact}
              </Text>
            ) : null}
          </View>
        </View>
        <Text style={styles.profileNote}>Same account as simplytk.com. Stars, scores and streaks stay in sync.</Text>
      </Hero>

      {SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: palette.textSecondary }]}>{section.title.toUpperCase()}</Text>
          <Group>
            {section.items.map((item) => (
              <Row
                key={item.label}
                icon={item.icon}
                tone={item.label === 'Sign out' ? 'red' : section.tone}
                title={item.label}
                chevron={'path' in item}
                onPress={() => open(item)}
              />
            ))}
          </Group>
        </View>
      ))}

      <View style={styles.footer}>
        <Wordmark size={18} />
        <Text style={[styles.footerText, { color: palette.faint }]}>
          Find the role. Win the offer. · {Platform.OS === 'ios' ? 'iOS' : 'Android'} {version}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: {
    gap: Spacing.three,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    backgroundColor: onHero.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: onHero.text,
    fontSize: 19,
    fontWeight: '700',
  },
  profileText: {
    flex: 1,
    gap: 2,
  },
  profileName: {
    color: onHero.text,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  profileContact: {
    color: onHero.secondary,
    fontSize: 14,
  },
  profileNote: {
    color: onHero.secondary,
    fontSize: 13,
    lineHeight: 18,
  },
  section: {
    gap: Spacing.two,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginLeft: Spacing.four,
  },
  footer: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  footerText: {
    fontSize: 12,
  },
});
