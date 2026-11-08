import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { usePalette } from '@/hooks/use-palette';

/**
 * The app's five native tabs. Home, Tracker, Daily and Ranks are native screens; More
 * lists everything else on simplytk.com, which opens in a web view.
 *
 * This is the system tab bar, so on iOS 26 it is Liquid Glass and shrinks while you
 * scroll down, as in Music and the App Store. The colours below only apply on iOS 18 and
 * earlier and on Android.
 */
export default function TabsLayout() {
  const palette = usePalette();

  return (
    <NativeTabs
      backgroundColor={palette.surface}
      tintColor={palette.tint}
      indicatorColor={palette.tintSoft}
      iconColor={{ default: palette.textSecondary, selected: palette.tint }}
      labelStyle={{
        default: { color: palette.textSecondary },
        selected: { color: palette.tint },
      }}
      minimizeBehavior="onScrollDown"
      disableTransparentOnScrollEdge>
      <NativeTabs.Trigger name="index" contentStyle={{ backgroundColor: palette.background }}>
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="tracker" contentStyle={{ backgroundColor: palette.background }}>
        <NativeTabs.Trigger.Label>Tracker</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'star', selected: 'star.fill' }} md="star" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="daily" contentStyle={{ backgroundColor: palette.background }}>
        <NativeTabs.Trigger.Label>Daily</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'flame', selected: 'flame.fill' }} md="local_fire_department" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="ranks" contentStyle={{ backgroundColor: palette.background }}>
        <NativeTabs.Trigger.Label>Ranks</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'trophy', selected: 'trophy.fill' }} md="emoji_events" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="more" contentStyle={{ backgroundColor: palette.background }}>
        <NativeTabs.Trigger.Label>More</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="line.3.horizontal" md="menu" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
