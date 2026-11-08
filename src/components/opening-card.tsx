import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { Card } from '@/components/ui';
import { Spacing, Tabular } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { openOutside } from '@/lib/open';
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

/** The deadline as a small tinted pill: red when it's days away, amber when it's close. */
export function DeadlinePill({ deadline, now }: { deadline: string | null; now: Date }) {
  const palette = usePalette();
  const label = deadlineLabel(deadline, now);
  const [fill, ink] =
    label.tone === 'urgent'
      ? [palette.dangerSoft, palette.danger]
      : label.tone === 'soon'
        ? [palette.warningSoft, palette.warning]
        : [palette.raised, palette.textSecondary];
  return (
    <View style={[styles.pill, { backgroundColor: fill }]}>
      <Text style={[styles.pillLabel, Tabular, { color: ink }]}>{label.text}</Text>
    </View>
  );
}

/** One opening, laid out like a card on simplytk.com's tracker. */
export function OpeningCard({ opening, now }: { opening: Opening; now: Date }) {
  const palette = usePalette();
  const firm = opening.companies?.name ?? '';
  const meta = [typeLabel(opening.programme_type), opening.location].filter(Boolean).join(' · ');
  return (
    <Card
      accessibilityLabel={`${firm} ${opening.title}`}
      onPress={() => router.push({ pathname: '/opening/[id]', params: { id: opening.id } })}
      style={[styles.card, { borderLeftColor: palette.tint }]}>
      <View style={styles.row}>
        <View style={styles.text}>
          <Text style={[styles.firm, { color: palette.text }]} numberOfLines={1}>
            {firm}
          </Text>
          <Text style={[styles.title, { color: palette.text }]} numberOfLines={2}>
            {opening.title}
          </Text>
          {meta ? (
            <Text style={[styles.meta, { color: palette.textSecondary }]} numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
        </View>
        <StarButton opening={opening} />
      </View>
      <View style={styles.footer}>
        <DeadlinePill deadline={opening.deadline} now={now} />
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Apply to ${firm}`}
          hitSlop={8}
          onPress={() => void openOutside(opening.apply_url, 'browser')}
          style={({ pressed }) => [
            styles.apply,
            { borderColor: palette.border, backgroundColor: palette.surface },
            pressed && { opacity: 0.6 },
          ]}>
          <Text style={[styles.applyLabel, { color: palette.text }]}>Apply</Text>
          <SymbolView
            name={{ ios: 'arrow.up.right', android: 'arrow_outward', web: 'arrow_outward' }}
            tintColor={palette.text}
            size={12}
          />
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
    paddingVertical: 14,
    borderLeftWidth: 3,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'flex-start',
  },
  text: {
    flex: 1,
    gap: 3,
  },
  firm: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  title: {
    fontSize: 15,
    lineHeight: 20,
  },
  meta: {
    fontSize: 13,
    marginTop: 2,
  },
  star: {
    padding: 2,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  apply: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  applyLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
});
