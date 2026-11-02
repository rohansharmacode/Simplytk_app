import { StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import type { Streak } from '@/lib/site-api';

const WEEKDAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** The last seven days: filled when played, outlined when a freeze covered it. */
export function StreakStrip({ streak }: { streak: Streak }) {
  const palette = usePalette();
  return (
    <View style={styles.row} accessibilityLabel={`Played ${streak.week.filter((d) => d.played).length} of the last 7 days`}>
      {streak.week.map((day) => {
        const weekday = WEEKDAY[new Date(`${day.day}T12:00:00Z`).getUTCDay()];
        return (
          <View key={day.day} style={styles.day}>
            <View
              style={[
                styles.dot,
                day.played
                  ? { backgroundColor: day.frozen ? 'transparent' : palette.tint, borderColor: palette.tint }
                  : { backgroundColor: 'transparent', borderColor: palette.hair },
              ]}
            />
            <Text style={[styles.label, { color: palette.faint }]}>{weekday}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  day: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
  },
  label: {
    fontSize: 11,
  },
});
