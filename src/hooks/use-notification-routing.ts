import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';

import { hrefForNotificationData } from '@/lib/routes';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/** Tab routes switch tabs; pages stack on top of whatever is showing. */
export function openHref(href: string) {
  if (href.startsWith('/page')) {
    router.push(href as Href);
  } else {
    router.navigate(href as Href);
  }
}

/**
 * Tapping a notification opens the page in its `data.url` (a simplytk.com URL or path),
 * both when the app is running and when the tap launched it.
 */
export function useNotificationRouting() {
  useEffect(() => {
    function handle(response: Notifications.NotificationResponse | null | undefined) {
      // Payloads come from the server; don't trust their shape.
      const href = hrefForNotificationData(response?.notification?.request?.content?.data);
      if (href) openHref(href);
    }

    // The tap that launched the app. This runs in the root layout, so a notifications
    // module that's unavailable (or misbehaving) must not take the app down with it.
    try {
      handle(Notifications.getLastNotificationResponse());
      Notifications.clearLastNotificationResponse();
    } catch {}

    const subscription = Notifications.addNotificationResponseReceivedListener(handle);
    return () => subscription.remove();
  }, []);
}
