import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MonoFont, Radius, Spacing, Tabular } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';

/**
 * The few pieces every native screen is built from, after Orbit: a mono kicker over a
 * two-tone title, quiet hairline cards, pill buttons and chips, tabular numbers.
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

export function Kicker({ children, color }: { children: ReactNode; color?: string }) {
  const palette = usePalette();
  return <Text style={[styles.kicker, { color: color ?? palette.tint }]}>{children}</Text>;
}

/** Two-tone title: the first line in text, the second in the secondary colour. */
export function Title({ kicker, title, subtitle }: { kicker?: string; title: string; subtitle?: string }) {
  const palette = usePalette();
  return (
    <View style={styles.titleBlock}>
      {kicker ? <Kicker>{kicker}</Kicker> : null}
      <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>
        {title}
        {subtitle ? <Text style={{ color: palette.textSecondary }}>{`\n${subtitle}`}</Text> : null}
      </Text>
    </View>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: { label: string; onPress: () => void } }) {
  const palette = usePalette();
  return (
    <View style={styles.sectionHeader}>
      <Kicker color={palette.textSecondary}>{title}</Kicker>
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
  const base = [styles.card, { backgroundColor: palette.surface, borderColor: palette.hair }, style];
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
          : { backgroundColor: palette.surface, borderColor: palette.hair, borderWidth: 1 },
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

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const palette = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        selected
          ? { backgroundColor: palette.tintSoft, borderColor: palette.tint }
          : { backgroundColor: palette.surface, borderColor: palette.hair },
      ]}>
      <Text style={[styles.chipLabel, { color: selected ? palette.tint : palette.textSecondary }]}>{label}</Text>
    </Pressable>
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
    fontFamily: MonoFont,
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  titleBlock: {
    gap: Spacing.two,
  },
  title: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '600',
    letterSpacing: -1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: -Spacing.two,
  },
  sectionAction: {
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    borderRadius: Radius.card,
    borderWidth: 1,
    padding: 18,
    gap: Spacing.three,
  },
  button: {
    minHeight: 50,
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
    minHeight: 36,
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  stat: {
    gap: 2,
  },
  statValue: {
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '600',
    letterSpacing: -1.2,
  },
  statLabel: {
    fontSize: 13,
  },
  empty: {
    alignItems: 'flex-start',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
  },
  loading: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
