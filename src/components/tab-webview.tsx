import { useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { SiteWebView, type SiteWebViewHandle } from '@/components/site-webview';
import { usePalette } from '@/hooks/use-palette';
import { TAB_HOME, type WebTab } from '@/lib/routes';
import { withAppSource } from '@/lib/site';

/**
 * A tab backed by a simplytk.com section. Native tabs render every screen up front, so the
 * WebView is only created the first time the tab is opened. Deep links arrive as a `path`
 * search param (see src/lib/routes.ts) and are shown in this tab's WebView.
 */
export function TabWebView({ tab }: { tab: WebTab }) {
  const palette = usePalette();
  const navigation = useNavigation();
  const { path } = useLocalSearchParams<{ path?: string }>();
  const webRef = useRef<SiteWebViewHandle>(null);
  // null until the tab is first focused.
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

  useEffect(() => {
    if (!path || initialPath === null) return;
    if (consumedAsInitial.current === path) {
      consumedAsInitial.current = null;
    } else {
      webRef.current?.navigate(path);
    }
    // Clear it so the same link can be opened again later.
    navigation.setParams({ path: undefined } as never);
  }, [path, initialPath, navigation]);

  if (initialPath === null) {
    return <View style={{ flex: 1, backgroundColor: palette.background }} />;
  }
  return <SiteWebView ref={webRef} initialPath={initialPath} insetTop />;
}
