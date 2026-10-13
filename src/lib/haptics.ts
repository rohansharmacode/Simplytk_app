import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Android's own haptics need no VIBRATE permission, unlike impactAsync there.
const ignore = () => {};

export function hapticCorrect() {
  if (Platform.OS === 'android') {
    Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm).catch(ignore);
  } else {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(ignore);
  }
}

export function hapticWrong() {
  if (Platform.OS === 'android') {
    Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Reject).catch(ignore);
  } else {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(ignore);
  }
}

export function hapticFinished() {
  if (Platform.OS === 'android') {
    Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm).catch(ignore);
  } else {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(ignore);
  }
}
