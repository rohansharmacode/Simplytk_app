import { Platform } from 'react-native';

/**
 * simplytk.com's own palette in both schemes (its CSS tokens, converted from oklch to sRGB),
 * so the app and the website look like one product. The hero card is the logo's blue.
 *
 * `hair` is the 1px card edge, `raised` the track behind segmented controls and the fill of
 * unselected chips, `tintSoft` a tinted fill, `faint` timestamps and captions only.
 */
export const Colors = {
  light: {
    background: '#F6F7FA',
    surface: '#FFFFFF',
    raised: '#ECEEF4',
    text: '#16181D',
    textSecondary: '#545A66',
    faint: '#7A808C',
    muted: '#ECEEF4',
    border: '#E2E5EC',
    hair: '#E2E5EC',
    tint: '#2B54E8',
    tintSoft: 'rgba(43,84,232,0.10)',
    onTint: '#FFFFFF',
    success: '#0E9F6E',
    successSoft: 'rgba(14,159,110,0.12)',
    danger: '#D92D20',
    dangerSoft: 'rgba(217,45,32,0.10)',
    warning: '#C2570C',
    warningSoft: 'rgba(234,128,12,0.14)',
    shadow: 'rgba(16,24,40,0.06)',
    glass: 'rgba(255,255,255,0.72)',
    heroFrom: '#2B54E8',
    heroTo: '#3D66F5',
  },
  dark: {
    background: '#12141A',
    surface: '#1B1E26',
    raised: '#242833',
    text: '#F6F7FA',
    textSecondary: '#A2A9B8',
    faint: '#7D8494',
    muted: '#242833',
    border: '#2C3140',
    hair: '#2C3140',
    tint: '#7492FF',
    tintSoft: 'rgba(116,146,255,0.16)',
    onTint: '#12141A',
    success: '#3DD598',
    successSoft: 'rgba(61,213,152,0.14)',
    danger: '#FF7B6B',
    dangerSoft: 'rgba(255,123,107,0.14)',
    warning: '#F7B05B',
    warningSoft: 'rgba(247,176,91,0.15)',
    shadow: 'rgba(0,0,0,0)',
    glass: 'rgba(36,40,51,0.7)',
    heroFrom: '#2446C9',
    heroTo: '#2B54E8',
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
export type Tone = 'blue' | 'green' | 'amber' | 'red';

export function toneColors(palette: Palette, tone: Tone): { fg: string; bg: string } {
  switch (tone) {
    case 'green':
      return { fg: palette.success, bg: palette.successSoft };
    case 'amber':
      return { fg: palette.warning, bg: palette.warningSoft };
    case 'red':
      return { fg: palette.danger, bg: palette.dangerSoft };
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
