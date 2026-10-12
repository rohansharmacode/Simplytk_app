import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';

import { Colors, type Scheme } from '@/constants/theme';
import { useNotificationRouting } from '@/hooks/use-notification-routing';
import { useScheme } from '@/hooks/use-palette';
// Importing this keeps the splash up until the first page has loaded.
import { hideSplash } from '@/lib/splash';

export const unstable_settings = {
  // A deep link straight to a page still has the tabs underneath to go back to.
  anchor: '(tabs)',
};

function navigationTheme(scheme: Scheme): Theme {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const palette = Colors[scheme];
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: palette.tint,
      background: palette.background,
      card: palette.surface,
      text: palette.text,
      border: palette.border,
    },
  };
}

export default function RootLayout() {
  const scheme = useScheme();
  const palette = Colors[scheme];

  useNotificationRouting();

  useEffect(() => {
    // Never leave the splash up if the network is slow; the page shows its own progress.
    const timer = setTimeout(hideSplash, 4000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(palette.background).catch(() => {});
  }, [palette.background]);

  return (
    <ThemeProvider value={navigationTheme(scheme)}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerTintColor: palette.tint,
          headerTitleStyle: { color: palette.text },
          headerStyle: { backgroundColor: palette.surface },
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: palette.background },
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="page" options={{ title: '' }} />
      </Stack>
    </ThemeProvider>
  );
}
