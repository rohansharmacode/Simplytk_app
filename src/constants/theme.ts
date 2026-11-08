import { Platform } from 'react-native';

/**
 * simplytk.com's own palette in both schemes (its CSS tokens, converted from oklch to sRGB),
 * so the native screens and the pages shown in web views look like one product.
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
    tintSoft: 'rgba(43,84,232,0.08)',
    onTint: '#FFFFFF',
    success: '#00875A',
    danger: '#D92D20',
    dangerSoft: 'rgba(217,45,32,0.08)',
    warning: '#C2570C',
    warningSoft: 'rgba(234,88,12,0.10)',
    shadow: 'rgba(16,24,40,0.06)',
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
    tintSoft: 'rgba(116,146,255,0.14)',
    onTint: '#12141A',
    success: '#3DB57F',
    danger: '#FF7B6B',
    dangerSoft: 'rgba(255,123,107,0.14)',
    warning: '#F5A65B',
    warningSoft: 'rgba(245,166,91,0.14)',
    shadow: 'rgba(0,0,0,0)',
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

/** The site's radius is 0.875rem: 14 for cards, 10 inside them. */
export const Radius = {
  small: 10,
  card: 14,
  pill: 999,
} as const;

/** For timers only. */
export const MonoFont = Platform.select({ ios: 'Menlo', default: 'monospace' });

/** The site's soft card shadow; nothing in dark mode, where the edge does the work. */
export function cardShadow(color: string) {
  return {
    shadowColor: '#101828',
    shadowOpacity: color === 'rgba(0,0,0,0)' ? 0 : 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: color === 'rgba(0,0,0,0)' ? 0 : 1,
  };
}

/** Counters, timers, scores and ranks never jitter as their digits change. */
export const Tabular = { fontVariant: ['tabular-nums' as const] };
