import { useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { SiteWebView, type SiteWebViewHandle } from '@/components/site-webview';
import { usePalette } from '@/hooks/use-palette';
import { useFirstPageLoaded } from '@/lib/app-state';
import { TAB_HOME, type WebTab } from '@/lib/routes';
import { withAppSource } from '@/lib/site';

/** How long after the first page loads before a `preload` tab starts loading. */
const PRELOAD_DELAY_MS = 1500;

type TabNavigation = {
  isFocused: () => boolean;
  setParams: (params: { path?: string }) => void;
  addListener: (event: 'tabPress', callback: () => void) => () => void;
};

/**
 * A tab backed by a simplytk.com section. Native tabs render every screen up front, so the
 * WebView is only created the first time the tab is opened, or shortly after launch for a
 * `preload` tab. Deep links arrive as a `path` search param (see src/lib/routes.ts) and
 * are shown in this tab's WebView.
 */
export function TabWebView({ tab, preload = false }: { tab: WebTab; preload?: boolean }) {
  const palette = usePalette();
  const navigation = useNavigation() as unknown as TabNavigation;
  const { path } = useLocalSearchParams<{ path?: string }>();
  const firstPageLoaded = useFirstPageLoaded();
  const webRef = useRef<SiteWebViewHandle>(null);
  // null until the tab is first focused (or preloaded).
  const [initialPath, setInitialPath] = useState<string | null>(null);
  // A deep link that opened the tab is already the initial page; don't navigate to it twice.
  const consumedAsInitial = useRef<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (initialPath !== null) return;
      if (path) consumedAsInitial.current = path;
      setInitialPath(path ?? withAppSource(TAB_HOME[tab]));
    }, [initialPath, path, tab]),
  );

  // Load in the background once the first screen is up, so opening the tab is instant.
  useEffect(() => {
    if (!preload || !firstPageLoaded || initialPath !== null) return;
    const timer = setTimeout(() => {
      setInitialPath((current) => current ?? withAppSource(TAB_HOME[tab]));
    }, PRELOAD_DELAY_MS);
    return () => clearTimeout(timer);
  }, [preload, firstPageLoaded, initialPath, tab]);

  useEffect(() => {
    if (!path || initialPath === null) return;
    if (consumedAsInitial.current === path) {
      consumedAsInitial.current = null;
    } else {
      webRef.current?.navigate(path);
    }
    // Clear it so the same link can be opened again later.
    navigation.setParams({ path: undefined });
  }, [path, initialPath, navigation]);

  // Tapping the tab that's already open scrolls to the top, then back to the tab's start.
  useEffect(
    () =>
      navigation.addListener('tabPress', () => {
        if (navigation.isFocused()) webRef.current?.scrollToTopOrGo(TAB_HOME[tab]);
      }),
    [navigation, tab],
  );

  if (initialPath === null) {
    return <View style={{ flex: 1, backgroundColor: palette.background }} />;
  }
  return <SiteWebView ref={webRef} initialPath={initialPath} insetTop />;
}
