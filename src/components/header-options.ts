import type { NativeStackNavigationOptions } from 'expo-router/native-stack';
import { Platform } from 'react-native';

import type { Palette } from '@/constants/theme';

/** iOS 26 draws its own Liquid Glass edge under the bar; earlier versions get a frosted blur. */
const LIQUID_GLASS = Platform.OS === 'ios' && Number(String(Platform.Version).split('.')[0]) >= 26;

/**
 * The navigation bar as in Music, the App Store and Mail: a large title that shrinks into the
 * bar as you scroll, with the content sliding under a see-through bar instead of a solid one.
 */
export function headerOptions(palette: Palette, large: boolean): NativeStackNavigationOptions {
  if (Platform.OS !== 'ios') {
    return {
      headerTintColor: palette.tint,
      headerTitleStyle: {
        color: palette.text,
        fontFamily: 'Inter_600SemiBold',
      },
      headerStyle: { backgroundColor: palette.surface },
      headerBackButtonDisplayMode: 'minimal',
      contentStyle: { backgroundColor: palette.background },
    };
  }
  return {
    headerLargeTitleEnabled: large,
    headerTransparent: true,
    // On iOS 26 the default soft edge lets the bright hero cards show through the shrunken
    // title, so text overlapped text (seen in the screenshot tour). The hard edge keeps the
    // bar readable, with the same Liquid Glass material.
    ...(LIQUID_GLASS
      ? {
          scrollEdgeEffects: {
            top: 'hard' as const,
            bottom: 'automatic' as const,
            left: 'automatic' as const,
            right: 'automatic' as const,
          },
        }
      : { headerBlurEffect: 'systemChromeMaterial' as const }),
    headerShadowVisible: false,
    headerLargeTitleShadowVisible: false,
    headerLargeStyle: { backgroundColor: 'transparent' },
    headerTintColor: palette.tint,
    headerTitleStyle: { color: palette.text, fontFamily: 'Inter_600SemiBold' },
    headerLargeTitleStyle: { color: palette.text, fontFamily: 'Inter_700Bold' },
    headerBackButtonDisplayMode: 'minimal',
    contentStyle: { backgroundColor: palette.background },
  };
}
