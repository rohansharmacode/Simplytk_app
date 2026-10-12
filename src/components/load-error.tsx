import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';

export function LoadError({ onRetry }: { onRetry: () => void }) {
  const palette = usePalette();
  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <SymbolView
        name={{ ios: 'wifi.slash', android: 'wifi_off', web: 'wifi_off' }}
        tintColor={palette.textSecondary}
        size={40}
      />
      <Text style={[styles.title, { color: palette.text }]}>Can’t reach simplytk</Text>
      <Text style={[styles.body, { color: palette.textSecondary }]}>
        Check your connection and try again.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: palette.tint, opacity: pressed ? 0.8 : 1 },
        ]}>
        <Text style={[styles.buttonLabel, { color: palette.onTint }]}>Try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.six,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: Spacing.two,
  },
  body: {
    fontSize: 15,
    textAlign: 'center',
  },
  button: {
    marginTop: Spacing.three,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.three,
    borderRadius: Radius.pill,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});
