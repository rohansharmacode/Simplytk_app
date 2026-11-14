import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Image, Pressable, StyleSheet, View } from 'react-native';

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

/** The firm's logo, or its initial on a tinted tile while there isn't one. */
export function FirmLogo({
  opening,
  size = 44,
}: {
  opening: { companies: { name: string; logo_url: string | null } | null };
  size?: number;
}) {
  const palette = usePalette();
  const firm = opening.companies?.name ?? '';
  const logo = opening.companies?.logo_url;
  const box = { width: size, height: size, borderRadius: size * 0.27 };
  if (logo) {
    return (
      <View style={[box, styles.logoBox, { backgroundColor: '#FFFFFF', borderColor: palette.hair }]}>
        <Image source={{ uri: logo }} style={{ width: size * 0.7, height: size * 0.7 }} resizeMode="contain" />
      </View>
    );
  }
  return (
    <View style={[box, styles.logoBox, { backgroundColor: palette.tintSoft, borderColor: palette.hair }]}>
      <Text style={[styles.initial, { color: palette.tint, fontSize: size * 0.42 }]}>{firm.slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}

/** One opening, laid out like a card in Orbit's Discover feed. */
export function OpeningCard({
  opening,
  now,
  note,
}: {
  opening: Opening;
  now: Date;
  /** A line over the card, e.g. when the live feed detected it; `fresh` adds a green dot. */
  note?: { text: string; fresh?: boolean };
}) {
  const palette = usePalette();
  const firm = opening.companies?.name ?? '';
  const type = typeLabel(opening.programme_type);
  return (
    <Card
      accessibilityLabel={`${firm} ${opening.title}`}
      onPress={() => router.push({ pathname: '/opening/[id]', params: { id: opening.id } })}
      style={styles.card}>
      {note ? (
        <View style={styles.note}>
          {note.fresh ? <View style={[styles.dot, { backgroundColor: palette.success }]} /> : null}
          <Text style={[styles.noteText, { color: note.fresh ? palette.success : palette.textSecondary }]}>{note.text}</Text>
        </View>
      ) : null}
      <View style={styles.row}>
        <FirmLogo opening={opening} />
        <View style={styles.text}>
          <Text style={[styles.firm, { color: palette.textSecondary }]} numberOfLines={1}>
            {firm}
          </Text>
          <Text style={[styles.title, { color: palette.text }]} numberOfLines={2}>
            {opening.title}
          </Text>
          {opening.location ? (
            <View style={styles.meta}>
              <SymbolView
                name={{ ios: 'mappin.and.ellipse', android: 'location_on', web: 'location_on' }}
                tintColor={palette.faint}
                size={12}
              />
              <Text style={[styles.metaText, { color: palette.textSecondary }]} numberOfLines={1}>
                {opening.location}
              </Text>
            </View>
          ) : null}
        </View>
        <StarButton opening={opening} />
      </View>
      <View style={styles.footer}>
        <DeadlinePill deadline={opening.deadline} now={now} />
        {type ? (
          <View style={[styles.pill, { backgroundColor: palette.raised }]}>
            <Text style={[styles.pillLabel, { color: palette.textSecondary }]}>{type}</Text>
          </View>
        ) : null}
        <View style={{ flex: 1 }} />
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Apply to ${firm}`}
          hitSlop={8}
          onPress={() => void openOutside(opening.apply_url, 'browser')}
          style={({ pressed }) => [styles.apply, { backgroundColor: palette.tintSoft }, pressed && { opacity: 0.6 }]}>
          <Text style={[styles.applyLabel, { color: palette.tint }]}>Apply</Text>
          <SymbolView
            name={{ ios: 'arrow.up.right', android: 'arrow_outward', web: 'arrow_outward' }}
            tintColor={palette.tint}
            size={11}
          />
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: -4,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  noteText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  card: {
    gap: 14,
    paddingVertical: 14,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'flex-start',
  },
  logoBox: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
  initial: {
    fontWeight: '700',
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
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  metaText: {
    fontSize: 13,
    flexShrink: 1,
  },
  star: {
    padding: 2,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
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
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  applyLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
});
