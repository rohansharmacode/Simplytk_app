import * as WebBrowser from 'expo-web-browser';
import { Linking, Platform, Share, type ShareContent } from 'react-native';

import type { LinkAction } from './site';

// iOS can report a target="_blank" click both as a navigation and as a new window;
// don't open the same link twice.
let lastOpened = { url: '', at: 0 };

/** Open a link that left simplytk.com: in the in-app browser sheet, or in its own app. */
export async function openOutside(url: string, action: Extract<LinkAction, 'browser' | 'system'>) {
  const now = Date.now();
  if (lastOpened.url === url && now - lastOpened.at < 1000) return;
  lastOpened = { url, at: now };

  const isWeb = /^https?:/i.test(url);
  try {
    if (action === 'browser') {
      await WebBrowser.openBrowserAsync(url, { dismissButtonStyle: 'close' });
      return;
    }
    await Linking.openURL(url);
  } catch {
    // No app claimed it (e.g. WhatsApp not installed): fall back to the browser sheet.
    if (action === 'system' && isWeb) {
      await WebBrowser.openBrowserAsync(url).catch(() => {});
    }
  }
}

/** Native share sheet. Android has no separate URL field, so it goes in the message. */
export async function shareLink({ title, text, url }: { title?: string; text?: string; url?: string }) {
  const content: ShareContent =
    Platform.OS === 'ios' && url
      ? { title, url, message: text }
      : { title, message: [text, url].filter(Boolean).join('\n') };
  try {
    await Share.share(content, { subject: title, dialogTitle: title });
  } catch {
    // Dismissed or unavailable; nothing to do.
  }
}
