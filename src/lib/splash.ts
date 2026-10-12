import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ fade: true, duration: 250 });

let hidden = false;

/** Hide the splash once the first screen has something to show (or the fallback timer fires). */
export function hideSplash() {
  if (hidden) return;
  hidden = true;
  SplashScreen.hideAsync().catch(() => {});
}
