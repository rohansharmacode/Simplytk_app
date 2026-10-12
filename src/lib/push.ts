import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

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

async function register(): Promise<PushResult> {
  if (!Device.isDevice) {
    return { status: 'unavailable', reason: 'Push notifications need a physical device.' };
  }

  // Android 13+ only shows the permission prompt once a channel exists.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Alerts',
      importance: Notifications.AndroidImportance.HIGH,
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
