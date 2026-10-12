/**
 * Colours are converted from simplytk.com's CSS design tokens (oklch -> sRGB) so the
 * native chrome (tab bar, headers, the More screen) matches the web content it frames.
 */
export const Colors = {
  light: {
    background: '#F6F7FA',
    surface: '#FFFFFF',
    text: '#16181D',
    textSecondary: '#545A66',
    muted: '#ECEEF4',
    border: '#E2E5EC',
    tint: '#2B54E8',
    onTint: '#FFFFFF',
  },
  dark: {
    background: '#12141A',
    surface: '#1B1E26',
    text: '#F6F7FA',
    textSecondary: '#A2A9B8',
    muted: '#242833',
    border: '#2C3140',
    tint: '#7492FF',
    onTint: '#12141A',
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
  card: 14,
  pill: 999,
} as const;
