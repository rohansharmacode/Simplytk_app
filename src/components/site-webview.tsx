import Constants from 'expo-constants';
import { useFocusEffect } from 'expo-router';
import { useCallback, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { BackHandler, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import type {
  ShouldStartLoadRequest,
  WebViewErrorEvent,
  WebViewMessageEvent,
  WebViewNavigation,
  WebViewOpenWindowEvent,
} from 'react-native-webview/lib/WebViewTypes';

import { LoadError } from '@/components/load-error';
import { usePalette } from '@/hooks/use-palette';
import { getSiteState, updateSiteState } from '@/lib/app-state';
import { bridgeScript, navigateScript, parseBridgeMessage, replyScript } from '@/lib/bridge';
import { openOutside, shareLink } from '@/lib/open';
import { requestPushToken } from '@/lib/push';
import {
  classifyUrl,
  cleanTitle,
  isIgnorableLoadError,
  isSiteUrl,
  SITE_HOSTS,
  siteUrl,
} from '@/lib/site';
import { hideSplash } from '@/lib/splash';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

const BRIDGE = bridgeScript({
  platform: Platform.OS,
  appVersion: APP_VERSION,
  siteHosts: SITE_HOSTS,
});

export type SiteWebViewHandle = {
  /** Show a site path, e.g. from a deep link or notification. */
  navigate: (path: string) => void;
};

type Props = {
  /** Site path loaded first, e.g. `/internship-tracker`. */
  initialPath: string;
  /** Pad for the status bar; screens with a native header don't need it. */
  insetTop?: boolean;
  onTitleChange?: (title: string) => void;
  onUrlChange?: (url: string) => void;
  ref?: Ref<SiteWebViewHandle>;
};

/**
 * One simplytk.com WebView with the app's navigation policy: simplytk pages stay inside,
 * other sites open in the in-app browser, mail/WhatsApp/store links go to their apps.
 */
export function SiteWebView({ initialPath, insetTop, onTitleChange, onUrlChange, ref }: Props) {
  const palette = usePalette();
  const webRef = useRef<WebView>(null);

  const [source, setSource] = useState(() => ({ uri: siteUrl(initialPath) }));
  // Bumped to remount the WebView after a failed load or a crashed web process.
  const [instance, setInstance] = useState(0);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);

  const currentUrl = useRef(source.uri);
  const failedUrl = useRef<string | null>(null);
  const canGoBack = useRef(false);
  const hasLoaded = useRef(false);
  // What this WebView last reported, to spot changes made in another tab.
  const reported = useRef<{ dark: boolean; signedIn: boolean } | null>(null);

  const remount = useCallback((uri: string) => {
    hasLoaded.current = false;
    failedUrl.current = null;
    setSource({ uri });
    setInstance((value) => value + 1);
    setFailed(false);
    setProgress(0);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      navigate(path: string) {
        const url = siteUrl(path);
        if (hasLoaded.current && !failedUrl.current) {
          webRef.current?.injectJavaScript(navigateScript(url));
        } else {
          remount(url);
        }
      },
    }),
    [remount],
  );

  useFocusEffect(
    useCallback(() => {
      // Signed in, out, or switched theme in another tab while this one was hidden.
      const shared = getSiteState();
      const mine = reported.current;
      if (
        mine &&
        shared.signedIn !== null &&
        shared.dark !== null &&
        (mine.signedIn !== shared.signedIn || mine.dark !== shared.dark)
      ) {
        webRef.current?.reload();
      }

      if (Platform.OS !== 'android') return;
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (!canGoBack.current) return false;
        webRef.current?.goBack();
        return true;
      });
      return () => subscription.remove();
    }, []),
  );

  const onShouldStartLoadWithRequest = useCallback((request: ShouldStartLoadRequest) => {
    // iOS: iframes (Stripe, embeds) load freely. Android reports every frame as top.
    if (!request.isTopFrame) return true;
    const action = classifyUrl(request.url);
    if (action === 'webview') return true;
    if (action !== 'block') void openOutside(request.url, action);
    return false;
  }, []);

  const onOpenWindow = useCallback(({ nativeEvent }: WebViewOpenWindowEvent) => {
    const url = nativeEvent.targetUrl;
    const action = classifyUrl(url);
    if (action === 'webview') {
      webRef.current?.injectJavaScript(navigateScript(url));
    } else if (action !== 'block') {
      void openOutside(url, action);
    }
  }, []);

  const onMessage = useCallback(
    ({ nativeEvent }: WebViewMessageEvent) => {
      const message = parseBridgeMessage(nativeEvent.data);
      if (!message) return;
      const fromSite = isSiteUrl(nativeEvent.url);

      switch (message.type) {
        case 'state':
          if (!fromSite) return;
          reported.current = { dark: message.dark, signedIn: message.signedIn };
          updateSiteState({ dark: message.dark, signedIn: message.signedIn });
          onTitleChange?.(cleanTitle(message.title));
          return;
        case 'share':
          void shareLink(message);
          return;
        case 'push:request':
          if (!fromSite) return;
          void requestPushToken().then((result) => {
            webRef.current?.injectJavaScript(replyScript(message.id, result));
          });
          return;
      }
    },
    [onTitleChange],
  );

  const onNavigationStateChange = useCallback(
    (navigation: WebViewNavigation) => {
      canGoBack.current = navigation.canGoBack;
      if (navigation.url) {
        currentUrl.current = navigation.url;
        onUrlChange?.(navigation.url);
      }
    },
    [onUrlChange],
  );

  const onError = useCallback(({ nativeEvent }: WebViewErrorEvent) => {
    if (isIgnorableLoadError(nativeEvent)) return;
    failedUrl.current = nativeEvent.url || currentUrl.current;
    setFailed(true);
  }, []);

  const retry = useCallback(() => {
    remount(failedUrl.current ?? currentUrl.current);
  }, [remount]);

  const edges: Edge[] = insetTop ? ['top', 'bottom'] : ['bottom'];
  const loading = progress > 0 && progress < 1 && !failed;

  return (
    <SafeAreaView edges={edges} style={[styles.fill, { backgroundColor: palette.background }]}>
      <View style={styles.fill}>
        <WebView
          key={instance}
          ref={webRef}
          source={source}
          style={[styles.fill, { backgroundColor: palette.background }]}
          originWhitelist={['*']}
          onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
          onOpenWindow={onOpenWindow}
          onFileDownload={({ nativeEvent }) => void openOutside(nativeEvent.downloadUrl, 'browser')}
          injectedJavaScriptBeforeContentLoaded={BRIDGE}
          onMessage={onMessage}
          onNavigationStateChange={onNavigationStateChange}
          onLoadProgress={({ nativeEvent }) => setProgress(nativeEvent.progress)}
          onLoad={() => {
            hasLoaded.current = true;
          }}
          onLoadEnd={hideSplash}
          onError={onError}
          onContentProcessDidTerminate={() => webRef.current?.reload()}
          onRenderProcessGone={() => remount(currentUrl.current)}
          applicationNameForUserAgent={`simplytk-app/${APP_VERSION}`}
          domStorageEnabled
          allowsBackForwardNavigationGestures
          pullToRefreshEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          mediaCapturePermissionGrantType="grantIfSameHostElsePrompt"
          webviewDebuggingEnabled={__DEV__}
        />
        {loading && (
          <View
            pointerEvents="none"
            style={[styles.progress, { width: `${progress * 100}%`, backgroundColor: palette.tint }]}
          />
        )}
        {failed && <LoadError onRetry={retry} />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  progress: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: 2,
  },
});
