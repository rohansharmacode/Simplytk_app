import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui';
import { Spacing, Tabular } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { toggleStar, useIsStarred } from '@/lib/stars';
import { deadlineLabel, typeLabel } from '@/lib/tracker/openings';
import type { Opening } from '@/lib/tracker/queries';

export function StarButton({ opening, size = 22 }: { opening: Opening; size?: number }) {
  const palette = usePalette();
  const starred = useIsStarred(opening.id);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={starred ? 'Remove star' : 'Star for alerts'}
      accessibilityState={{ selected: starred }}
      hitSlop={12}
      onPress={() => void toggleStar(opening)}
      style={({ pressed }) => [styles.star, pressed && { opacity: 0.5 }]}>
      <SymbolView
        name={{ ios: starred ? 'star.fill' : 'star', android: 'star', web: 'star' }}
        tintColor={starred ? palette.tint : palette.faint}
        size={size}
        type={starred ? 'monochrome' : undefined}
      />
    </Pressable>
  );
}

export function OpeningCard({ opening, now }: { opening: Opening; now: Date }) {
  const palette = usePalette();
  const deadline = deadlineLabel(opening.deadline, now);
  const deadlineColor =
    deadline.tone === 'urgent' ? palette.danger : deadline.tone === 'soon' ? palette.warning : palette.textSecondary;
  const firm = opening.companies?.name ?? '';
  const meta = [typeLabel(opening.programme_type), opening.location].filter(Boolean).join(' · ');
  return (
    <Card
      accessibilityLabel={`${firm} ${opening.title}`}
      onPress={() => router.push({ pathname: '/opening/[id]', params: { id: opening.id } })}
      style={styles.card}>
      <View style={styles.row}>
        <View style={styles.text}>
          <Text style={[styles.firm, { color: palette.textSecondary }]} numberOfLines={1}>
            {firm}
          </Text>
          <Text style={[styles.title, { color: palette.text }]} numberOfLines={2}>
            {opening.title}
          </Text>
        </View>
        <StarButton opening={opening} />
      </View>
      <View style={styles.footer}>
        <Text style={[styles.meta, { color: palette.textSecondary }]} numberOfLines={1}>
          {meta}
        </Text>
        <Text style={[styles.deadline, Tabular, { color: deadlineColor }]}>{deadline.text}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
    paddingVertical: 14,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'flex-start',
  },
  text: {
    flex: 1,
    gap: 2,
  },
  firm: {
    fontSize: 13,
    fontWeight: '500',
  },
  title: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  star: {
    padding: 2,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  meta: {
    flex: 1,
    fontSize: 13,
  },
  deadline: {
    fontSize: 13,
    fontWeight: '600',
  },
});
