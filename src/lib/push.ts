import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import { deletePushToken, savePushToken } from '@/lib/site-api';

export type PushResult =
  | { status: 'granted'; token: string }
  | { status: 'denied' }
  | { status: 'unavailable'; reason: string };

let inFlight: Promise<PushResult> | null = null;

/**
 * Ask for notification permission and return this install's Expo push token. Called when
 * the site asks for it (window.SimplytkNative.requestPushToken), so the OS prompt appears
 * when the student turns on alerts rather than on first launch.
 */
export function requestPushToken(): Promise<PushResult> {
  inFlight ??= register().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/**
 * Keep this device's token on the student's account so opening and deadline alerts reach
 * it. With `ask` the OS prompt may appear (call it from a tap, such as the first star);
 * without, it only refreshes a token the student already allowed. Never throws.
 */
export async function syncPushToken({ ask }: { ask: boolean }): Promise<PushResult> {
  try {
    if (!ask) {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') return { status: 'denied' };
    }
    const result = await requestPushToken();
    if (result.status === 'granted') {
      await savePushToken(result.token, Platform.OS === 'ios' ? 'ios' : 'android');
      lastSaved = result.token;
    }
    return result;
  } catch (error) {
    return { status: 'unavailable', reason: String(error) };
  }
}

let lastSaved: string | null = null;

/** On sign-out: stop this device getting the previous student's alerts. */
export async function forgetPushToken() {
  const token = lastSaved;
  lastSaved = null;
  if (token) await deletePushToken(token).catch(() => {});
}

async function register(): Promise<PushResult> {
  if (!Device.isDevice) {
    return { status: 'unavailable', reason: 'Push notifications need a physical device.' };
  }

  // Android 13+ only shows the permission prompt once a channel exists.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Alerts',
      importance: AndroidImportance.HIGH,
      lightColor: '#2B54E8',
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') return { status: 'denied' };

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    return { status: 'unavailable', reason: 'No EAS project ID; run `npx eas-cli init`.' };
  }

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return { status: 'granted', token: data };
  } catch (error) {
    return { status: 'unavailable', reason: String(error) };
  }
}
