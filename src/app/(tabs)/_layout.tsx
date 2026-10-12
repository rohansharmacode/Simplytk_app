import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { usePalette } from '@/hooks/use-palette';

/** Mirrors simplytk.com's own mobile tab bar, which the app hides (see src/lib/bridge.ts). */
export default function TabsLayout() {
  const palette = usePalette();

  return (
    <NativeTabs
      backgroundColor={palette.surface}
      tintColor={palette.tint}
      indicatorColor={palette.muted}
      iconColor={{ default: palette.textSecondary, selected: palette.tint }}
      labelStyle={{
        default: { color: palette.textSecondary },
        selected: { color: palette.tint },
      }}
      disableTransparentOnScrollEdge>
      <NativeTabs.Trigger name="index" contentStyle={{ backgroundColor: palette.background }}>
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="explore" contentStyle={{ backgroundColor: palette.background }}>
        <NativeTabs.Trigger.Label>Explore</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'safari', selected: 'safari.fill' }} md="explore" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="tracker" contentStyle={{ backgroundColor: palette.background }}>
        <NativeTabs.Trigger.Label>Tracker</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="progress" contentStyle={{ backgroundColor: palette.background }}>
        <NativeTabs.Trigger.Label>Progress</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="chart.line.uptrend.xyaxis" md="trending_up" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="more" contentStyle={{ backgroundColor: palette.background }}>
        <NativeTabs.Trigger.Label>More</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="line.3.horizontal" md="menu" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
