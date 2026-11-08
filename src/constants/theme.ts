import { Platform } from 'react-native';

/**
 * simplytk's blue on an iOS grouped background, in the style of the Orbit app: white cards
 * on a cool grey in light mode, deep navy in dark, and a navy hero card in both.
 *
 * `hair` is the 1px card edge, `raised` the track behind segmented controls and the fill of
 * unselected chips, `tintSoft` a tinted fill, `faint` timestamps and captions only.
 */
export const Colors = {
  light: {
    background: '#F2F4F8',
    surface: '#FFFFFF',
    raised: '#E8EBF1',
    text: '#0F1422',
    textSecondary: '#5B6273',
    faint: '#8A90A0',
    muted: '#ECEEF4',
    border: '#E3E6ED',
    hair: 'rgba(15,20,34,0.06)',
    tint: '#2B54E8',
    tintSoft: 'rgba(43,84,232,0.10)',
    onTint: '#FFFFFF',
    success: '#0E9F6E',
    successSoft: 'rgba(14,159,110,0.12)',
    danger: '#D92D20',
    dangerSoft: 'rgba(217,45,32,0.10)',
    warning: '#C2570C',
    warningSoft: 'rgba(234,128,12,0.14)',
    purple: '#7C4DDB',
    purpleSoft: 'rgba(124,77,219,0.12)',
    shadow: 'rgba(16,24,40,0.06)',
    glass: 'rgba(255,255,255,0.72)',
    heroFrom: '#0D1A45',
    heroTo: '#1C3C9E',
  },
  dark: {
    background: '#0A0E1A',
    surface: '#141A2A',
    raised: '#1E2539',
    text: '#F3F5FA',
    textSecondary: '#A3AABB',
    faint: '#788096',
    muted: '#1E2539',
    border: '#232B41',
    hair: 'rgba(255,255,255,0.06)',
    tint: '#7492FF',
    tintSoft: 'rgba(116,146,255,0.16)',
    onTint: '#0A0E1A',
    success: '#3DD598',
    successSoft: 'rgba(61,213,152,0.14)',
    danger: '#FF7B6B',
    dangerSoft: 'rgba(255,123,107,0.14)',
    warning: '#F7B05B',
    warningSoft: 'rgba(247,176,91,0.15)',
    purple: '#B59BFF',
    purpleSoft: 'rgba(181,155,255,0.15)',
    shadow: 'rgba(0,0,0,0)',
    glass: 'rgba(28,34,52,0.66)',
    heroFrom: '#111B3F',
    heroTo: '#1B3184',
  },
} as const;

export type Scheme = keyof typeof Colors;
export type Palette = (typeof Colors)[Scheme];

export const Spacing = {
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  five: 24,
  six: 32,
} as const;

/** iOS-style continuous corners: 20 for cards, 12 inside them. */
export const Radius = {
  small: 12,
  card: 20,
  pill: 999,
} as const;

/** The coloured icon tiles and tinted action pills, as in Apple's own apps. */
export type Tone = 'blue' | 'green' | 'amber' | 'red' | 'purple';

export function toneColors(palette: Palette, tone: Tone): { fg: string; bg: string } {
  switch (tone) {
    case 'green':
      return { fg: palette.success, bg: palette.successSoft };
    case 'amber':
      return { fg: palette.warning, bg: palette.warningSoft };
    case 'red':
      return { fg: palette.danger, bg: palette.dangerSoft };
    case 'purple':
      return { fg: palette.purple, bg: palette.purpleSoft };
    default:
      return { fg: palette.tint, bg: palette.tintSoft };
  }
}

/** For timers only. */
export const MonoFont = Platform.select({ ios: 'Menlo', default: 'monospace' });

/** The site's soft card shadow; nothing in dark mode, where the edge does the work. */
export function cardShadow(color: string) {
  return {
    shadowColor: '#101828',
    shadowOpacity: color === 'rgba(0,0,0,0)' ? 0 : 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: color === 'rgba(0,0,0,0)' ? 0 : 1,
  };
}

/** Counters, timers, scores and ranks never jitter as their digits change. */
export const Tabular = { fontVariant: ['tabular-nums' as const] };
