/**
 * Stand-in for react-native-webview in Jest. Each mounted WebView is recorded with its
 * latest props and jest.fn() ref methods, so tests can fire the native callbacks
 * (navigation requests, messages, errors) and see what the app asked the page to do.
 */
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, type Ref } from 'react';
import { View } from 'react-native';

export type MockWebView = {
  props: Record<string, any>;
  injectJavaScript: jest.Mock;
  reload: jest.Mock;
  goBack: jest.Mock;
  mounted: boolean;
};

const all: MockWebView[] = [];

/** WebViews currently on screen, oldest first. */
export function mountedWebViews() {
  return all.filter((webView) => webView.mounted);
}

export function resetWebViews() {
  all.length = 0;
}

export const WebView = forwardRef(function WebView(props: Record<string, any>, ref: Ref<unknown>) {
  const methods = useMemo(
    () => ({ injectJavaScript: jest.fn(), reload: jest.fn(), goBack: jest.fn() }),
    [],
  );
  const record = useRef<MockWebView | null>(null);
  if (!record.current) {
    record.current = { props, ...methods, mounted: true };
    all.push(record.current);
  }
  record.current.props = props;
  useImperativeHandle(ref, () => methods, [methods]);
  useEffect(
    () => () => {
      if (record.current) record.current.mounted = false;
    },
    [],
  );
  return <View testID="webview" accessibilityLabel={props.source?.uri} />;
});

export default WebView;
