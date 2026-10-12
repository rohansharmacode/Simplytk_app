import { useColorScheme } from 'react-native';

import { Colors, type Scheme } from '@/constants/theme';
import { useSiteState } from '@/lib/app-state';

/** Native chrome follows the site's theme once a page has reported it, else the OS. */
export function useScheme(): Scheme {
  const os = useColorScheme();
  const { dark } = useSiteState();
  if (dark !== null) return dark ? 'dark' : 'light';
  return os === 'dark' ? 'dark' : 'light';
}

export function usePalette() {
  return Colors[useScheme()];
}
