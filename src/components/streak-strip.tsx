import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import type { Streak } from '@/lib/site-api';

const WEEKDAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * The last seven days as bars, as on Orbit's "This week" card: tall when played, half when
 * a freeze covered it, a stub when missed. Today is the last bar.
 */
export function StreakStrip({ streak, height = 34 }: { streak: Streak; height?: number }) {
  const palette = usePalette();
  return (
    <View style={styles.row} accessibilityLabel={`Played ${streak.week.filter((d) => d.played).length} of the last 7 days`}>
      {streak.week.map((day) => {
        const weekday = WEEKDAY[new Date(`${day.day}T12:00:00Z`).getUTCDay()];
        const barHeight = day.played ? (day.frozen ? height * 0.5 : height) : 5;
        return (
          <View key={day.day} style={styles.day}>
            <View style={{ height, justifyContent: 'flex-end' }}>
              <View
                style={[
                  styles.bar,
                  {
                    height: barHeight,
                    backgroundColor: day.played ? (day.frozen ? palette.tintSoft : palette.tint) : palette.raised,
                  },
                ]}
              />
            </View>
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
    gap: 6,
  },
  day: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.one,
  },
  bar: {
    width: '100%',
    maxWidth: 18,
    minWidth: 8,
    borderRadius: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
  },
});
