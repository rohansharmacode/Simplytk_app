import { Stack, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { SiteWebView } from '@/components/site-webview';
import { Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { openOutside, shareLink } from '@/lib/open';
import { sitePathFromUrl, siteUrl } from '@/lib/site';

/** Any simplytk.com page pushed over the tabs: More menu entries and deep links. */
export default function PageScreen() {
  const palette = usePalette();
  const params = useLocalSearchParams<{ path?: string; title?: string }>();
  const [initialPath] = useState(() => params.path || '/');
  const [url, setUrl] = useState(() => siteUrl(initialPath));
  const [documentTitle, setDocumentTitle] = useState('');

  // Keep the menu label while on the page that was opened, then follow the page title.
  const onInitialPage = sitePathFromUrl(url)?.split(/[?#]/)[0] === initialPath.split(/[?#]/)[0];
  const title = (onInitialPage && params.title) || documentTitle || params.title || '';

  return (
    <>
      <Stack.Screen
        options={{
          title,
          headerRight: () => (
            <View style={styles.actions}>
              <HeaderButton
                label="Share"
                icon={{ ios: 'square.and.arrow.up', android: 'share' }}
                color={palette.tint}
                onPress={() => void shareLink({ title, url })}
              />
              <HeaderButton
                label="Open in browser"
                icon={{ ios: 'safari', android: 'open_in_browser' }}
                color={palette.tint}
                onPress={() => void openOutside(url, 'browser')}
              />
            </View>
          ),
        }}
      />
      <SiteWebView initialPath={initialPath} onTitleChange={setDocumentTitle} onUrlChange={setUrl} />
    </>
  );
}

function HeaderButton({
  label,
  icon,
  color,
  onPress,
}: {
  label: string;
  icon: { ios: 'square.and.arrow.up' | 'safari'; android: 'share' | 'open_in_browser' };
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <SymbolView name={{ ...icon, web: icon.android }} tintColor={color} size={22} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: Spacing.four,
  },
  button: {
    padding: Spacing.one,
  },
  pressed: {
    opacity: 0.5,
  },
});
