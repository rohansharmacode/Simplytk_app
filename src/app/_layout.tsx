import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/inter';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';

import { Colors, type Scheme } from '@/constants/theme';
import { useNotificationRouting } from '@/hooks/use-notification-routing';
import { useScheme } from '@/hooks/use-palette';
import { forgetPushToken, syncPushToken } from '@/lib/push';
import { useSession } from '@/lib/session';
import { clearStars, loadStars } from '@/lib/stars';
import { clearDaily } from '@/lib/daily/store';
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

  const session = useSession();
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });
  const userId = session?.user.id ?? null;
  const ready = session !== undefined && (fontsLoaded || !!fontError);

  useNotificationRouting(ready);

  // A new student: their stars, and this device's token on their account if they allowed
  // notifications before. Signed out: nothing of the last student's stays on the device.
  useEffect(() => {
    if (userId) {
      void loadStars();
      void syncPushToken({ ask: false });
    } else {
      clearStars();
      clearDaily();
      void forgetPushToken();
    }
  }, [userId]);

  useEffect(() => {
    // Never leave the splash up if the network is slow; the page shows its own progress.
    const timer = setTimeout(hideSplash, 4000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(palette.background).catch(() => {});
  }, [palette.background]);

  // The stored session is read before anything shows, so a signed-in student never sees
  // the sign-in screen flash. The splash stays up meanwhile.
  // Inter is waited for too, so text never jumps from the system face.
  if (!ready) return null;

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
        <Stack.Protected guard={session === null} redirectTo="/">
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={!!session} redirectTo="/sign-in">
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="opening/[id]" options={{ title: '' }} />
          <Stack.Screen
            name="challenge"
            options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }}
          />
          <Stack.Screen name="drills" options={{ title: 'Drills' }} />
          <Stack.Screen name="play/[slug]" options={{ title: '' }} />
          <Stack.Screen name="applications" options={{ title: '' }} />
          <Stack.Screen name="opening-soon" options={{ title: '' }} />
          <Stack.Screen name="live" options={{ title: '' }} />
          <Stack.Screen name="opportunities" options={{ title: '' }} />
          <Stack.Screen name="progress" options={{ title: '' }} />
          <Stack.Screen name="oa-prep" options={{ title: '' }} />
          <Stack.Screen name="duels/index" options={{ title: '' }} />
          <Stack.Screen name="duels/[code]" options={{ title: '' }} />
          <Stack.Screen name="course/index" options={{ title: '' }} />
          <Stack.Screen name="course/[module]" options={{ title: '' }} />
        </Stack.Protected>
        <Stack.Screen name="page" options={{ title: '' }} />
      </Stack>
    </ThemeProvider>
  );
}
