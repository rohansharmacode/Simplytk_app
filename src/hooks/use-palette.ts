import { useColorScheme } from 'react-native';

import { Colors, type Scheme } from '@/constants/theme';

/** The app follows the phone's light or dark setting. */
export function useScheme(): Scheme {
  return useColorScheme() === 'dark' ? 'dark' : 'light';
}

export function usePalette() {
  return Colors[useScheme()];
}
