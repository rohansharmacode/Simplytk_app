import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import type { ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { cardShadow, Radius, Spacing, Tabular } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';

/**
 * The pieces every native screen is built from, after simplytk.com: Inter, white cards with
 * a hairline edge and a soft shadow, blue pill buttons, grey segmented controls, and iOS
 * large titles. Numbers are tabular so counters don't jitter.
 */

export function Screen({
  children,
  refreshing,
  onRefresh,
  footer,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Pinned under the scrolling content, e.g. your own leaderboard row. */
  footer?: ReactNode;
}) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  // iOS insets the scroll view under the status bar itself; Android tabs don't.
  const topInset = Platform.OS === 'android' ? insets.top : 0;
  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingTop: topInset + Spacing.four }]}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={palette.textSecondary} />
          ) : undefined
        }>
        {children}
      </ScrollView>
      {footer}
    </View>
  );
}

/** A small uppercase label: a section header, or the line above a title. */
export function Kicker({ children, color }: { children: ReactNode; color?: string }) {
  const palette = usePalette();
  return <Text style={[styles.kicker, { color: color ?? palette.textSecondary }]}>{children}</Text>;
}

/** An iOS large title, with an optional short line under it. */
export function Title({ kicker, title, subtitle }: { kicker?: string; title: string; subtitle?: string }) {
  const palette = usePalette();
  return (
    <View style={styles.titleBlock}>
      {kicker ? <Kicker color={palette.tint}>{kicker}</Kicker> : null}
      <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>
        {title}
      </Text>
      {subtitle ? <Text style={[styles.subtitle, { color: palette.textSecondary }]}>{subtitle}</Text> : null}
    </View>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: { label: string; onPress: () => void } }) {
  const palette = usePalette();
  return (
    <View style={styles.sectionHeader}>
      <Text accessibilityRole="header" style={[styles.sectionTitle, { color: palette.text }]}>
        {title}
      </Text>
      {action ? (
        <Pressable accessibilityRole="button" hitSlop={8} onPress={action.onPress}>
          <Text style={[styles.sectionAction, { color: palette.tint }]}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Card({
  children,
  onPress,
  style,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const palette = usePalette();
  const base = [
    styles.card,
    { backgroundColor: palette.surface, borderColor: palette.hair },
    cardShadow(palette.shadow),
    style,
  ];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [base, pressed && { backgroundColor: palette.raised }]}>
      {children}
    </Pressable>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  busy,
  icon,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  busy?: boolean;
  icon?: Icon;
}) {
  const palette = usePalette();
  const primary = variant === 'primary';
  const color = primary ? palette.onTint : palette.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || !!busy, busy: !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary
          ? { backgroundColor: palette.tint }
          : [{ backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1 }, cardShadow(palette.shadow)],
        (disabled || busy) && { opacity: 0.5 },
        pressed && { transform: [{ scale: 0.97 }] },
      ]}>
      {busy ? (
        <ActivityIndicator color={color} />
      ) : (
        <>
          {icon ? <SymbolView name={{ ...icon, web: icon.android }} tintColor={color} size={18} /> : null}
          <Text style={[styles.buttonLabel, { color }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

/** A filter pill: grey when off, filled blue when on. */
export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const palette = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: selected ? palette.tint : palette.raised },
        pressed && { opacity: 0.7 },
      ]}>
      <Text style={[styles.chipLabel, { color: selected ? palette.onTint : palette.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

/** The site's segmented control: a grey track with the chosen option raised in white. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly (readonly [T, string])[];
  value: T;
  onChange: (value: T) => void;
}) {
  const palette = usePalette();
  return (
    <View accessibilityRole="tablist" style={[styles.segmented, { backgroundColor: palette.raised }]}>
      {options.map(([option, label]) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option)}
            style={[
              styles.segment,
              selected && [{ backgroundColor: palette.surface }, cardShadow(palette.shadow)],
            ]}>
            <Text
              numberOfLines={1}
              style={[styles.segmentLabel, { color: selected ? palette.text : palette.textSecondary }]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A big number with a small caption, e.g. the streak. */
export function Stat({ value, label, color }: { value: string; label: string; color?: string }) {
  const palette = usePalette();
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, Tabular, { color: color ?? palette.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: palette.textSecondary }]}>{label}</Text>
    </View>
  );
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  const palette = usePalette();
  return (
    <Card style={styles.empty}>
      <Text style={[styles.emptyTitle, { color: palette.text }]}>{title}</Text>
      {body ? <Text style={[styles.body, { color: palette.textSecondary }]}>{body}</Text> : null}
      {action}
    </Card>
  );
}

export function Loading() {
  const palette = usePalette();
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={palette.textSecondary} />
    </View>
  );
}

/**
 * simplytk.com's header logo: the dumbbell mark (public/favicon.svg on the site, drawn here
 * at its proportions) and the wordmark with "tk" in blue.
 */
export function Wordmark({ size = 22 }: { size?: number }) {
  const palette = usePalette();
  const u = size / 22; // the mark is 32 × 18 at size 22
  return (
    <View accessible accessibilityLabel="simplytk" style={styles.wordmark}>
      <View style={{ width: 32 * u, height: 18 * u, justifyContent: 'center' }}>
        <View style={{ position: 'absolute', left: 4 * u, right: 4 * u, height: 7.6 * u, borderRadius: 3.8 * u, backgroundColor: palette.tint }} />
        <View style={{ position: 'absolute', left: 0, width: 10.2 * u, height: 17.8 * u, borderRadius: 3.8 * u, backgroundColor: palette.tint }} />
        <View style={{ position: 'absolute', right: 0, width: 10.2 * u, height: 17.8 * u, borderRadius: 3.8 * u, backgroundColor: palette.tint }} />
      </View>
      <Text style={[styles.wordmarkText, { fontSize: size, color: palette.text }]}>
        simply<Text style={{ color: palette.tint }}>tk</Text>
      </Text>
    </View>
  );
}

export type Icon = { ios: SFSymbol; android: AndroidSymbol };

export function IconTile({ icon, color }: { icon: Icon; color?: string }) {
  const palette = usePalette();
  return (
    <View style={[styles.iconTile, { backgroundColor: palette.tintSoft }]}>
      <SymbolView name={{ ...icon, web: icon.android }} tintColor={color ?? palette.tint} size={18} />
    </View>
  );
}

export const text = StyleSheet.create({
  body: { fontSize: 15, lineHeight: 21 },
  small: { fontSize: 13, lineHeight: 18 },
  strong: { fontSize: 16, fontWeight: '600', letterSpacing: -0.2 },
});

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.five,
  },
  kicker: {
    fontSize: 13,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  titleBlock: {
    gap: 6,
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
    letterSpacing: -0.9,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 23,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: -Spacing.two,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  sectionAction: {
    fontSize: 15,
    fontWeight: '500',
  },
  card: {
    borderRadius: Radius.card,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  button: {
    minHeight: 48,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.five,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  chip: {
    minHeight: 34,
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
  },
  segment: {
    flex: 1,
    minHeight: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  segmentLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  stat: {
    gap: 2,
  },
  statValue: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  statLabel: {
    fontSize: 13,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.five,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
  loading: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
  },
  wordmark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wordmarkText: {
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
