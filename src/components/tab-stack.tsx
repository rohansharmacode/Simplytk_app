import { Stack } from 'expo-router';

import { headerOptions } from '@/components/header-options';
import { usePalette } from '@/hooks/use-palette';

/**
 * Each tab is its own stack with a large title, as in Music, the App Store and Mail. The
 * screen's `Title` sets the words and the buttons on the right.
 */
export function TabStack({ title }: { title: string }) {
  const palette = usePalette();
  return (
    <Stack screenOptions={headerOptions(palette, true)}>
      <Stack.Screen name="index" options={{ title }} />
    </Stack>
  );
}
