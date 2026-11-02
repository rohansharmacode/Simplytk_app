import { Platform } from 'react-native';

/**
 * Light is simplytk.com's own palette (its CSS tokens converted from oklch to sRGB), so the
 * native screens sit naturally beside the pages still shown in web views. Dark follows
 * Rohan's Orbit design system: a midnight ground, quiet hairline cards, one blue accent.
 *
 * `hair` is the 1px card edge, `raised` the fill for chips and pressed rows, `tintSoft`
 * the selected-chip fill, `faint` timestamps and captions only (never body copy).
 */
export const Colors = {
  light: {
    background: '#F6F7FA',
    surface: '#FFFFFF',
    raised: '#ECEEF4',
    text: '#16181D',
    textSecondary: '#545A66',
    faint: '#6E7482',
    muted: '#ECEEF4',
    border: '#E2E5EC',
    hair: 'rgba(22,24,29,0.08)',
    tint: '#2B54E8',
    tintSoft: 'rgba(43,84,232,0.10)',
    onTint: '#FFFFFF',
    success: '#009966',
    danger: '#D92D20',
    warning: '#B25E09',
  },
  dark: {
    background: '#090E18',
    surface: '#111827',
    raised: '#172033',
    text: '#EEF2F9',
    textSecondary: '#9AA5BA',
    faint: '#7A859C',
    muted: '#172033',
    border: '#1F2A3F',
    hair: 'rgba(255,255,255,0.08)',
    tint: '#5B8CFF',
    tintSoft: 'rgba(91,140,255,0.14)',
    onTint: '#FFFFFF',
    success: '#3DB57F',
    danger: '#F0857C',
    warning: '#F5C77E',
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

export const Radius = {
  small: 12,
  card: 16,
  pill: 999,
} as const;

/** Orbit's mono kickers: small, uppercase, widely tracked. */
export const MonoFont = Platform.select({ ios: 'Menlo', default: 'monospace' });

/** Counters, timers, scores and ranks never jitter as their digits change. */
export const Tabular = { fontVariant: ['tabular-nums' as const] };
