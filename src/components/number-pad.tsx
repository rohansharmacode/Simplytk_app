import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Radius, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';

export type PadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | '-' | '/' | 'back';

const ROWS: (PadKey | 'enter' | null)[][] = [
  ['1', '2', '3', 'back'],
  ['4', '5', '6', '-'],
  ['7', '8', '9', '/'],
  ['.', '0', null, 'enter'],
];

const LABELS: Partial<Record<PadKey, string>> = { '-': '−', back: 'Delete' };

/**
 * The daily challenge's keypad: big keys that register on touch-down, so mental maths is
 * as quick as tapping digits. No text field and no system keyboard to dismiss.
 */
export function NumberPad({
  onKey,
  onEnter,
  fraction,
  canSubmit,
}: {
  onKey: (key: PadKey) => void;
  onEnter: () => void;
  /** Sequences can be fractions, so they get the / key. */
  fraction: boolean;
  canSubmit: boolean;
}) {
  const palette = usePalette();
  return (
    <View style={styles.pad}>
      {ROWS.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((key, c) => {
            if (key === null || (key === '/' && !fraction)) return <View key={c} style={styles.key} />;
            if (key === 'enter') {
              return (
                <Pressable
                  key={c}
                  accessibilityRole="button"
                  accessibilityLabel="Submit answer"
                  accessibilityState={{ disabled: !canSubmit }}
                  disabled={!canSubmit}
                  onPressIn={onEnter}
                  style={({ pressed }) => [
                    styles.key,
                    { backgroundColor: palette.tint, opacity: canSubmit ? (pressed ? 0.8 : 1) : 0.4 },
                  ]}>
                  <SymbolView name={{ ios: 'return', android: 'keyboard_return', web: 'keyboard_return' }} tintColor={palette.onTint} size={22} />
                </Pressable>
              );
            }
            return (
              <Pressable
                key={c}
                accessibilityRole="button"
                accessibilityLabel={LABELS[key] ?? key}
                onPressIn={() => onKey(key)}
                style={({ pressed }) => [
                  styles.key,
                  { backgroundColor: pressed ? palette.raised : palette.surface, borderColor: palette.hair },
                ]}>
                {key === 'back' ? (
                  <SymbolView name={{ ios: 'delete.left', android: 'backspace', web: 'backspace' }} tintColor={palette.text} size={22} />
                ) : (
                  <Text style={[styles.label, { color: palette.text }]}>{LABELS[key] ?? key}</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  key: {
    flex: 1,
    height: 58,
    borderRadius: Radius.small,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 26,
    fontWeight: '500',
  },
});
