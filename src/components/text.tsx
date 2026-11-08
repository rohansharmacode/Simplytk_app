import {
  StyleSheet,
  Text as NativeText,
  TextInput as NativeTextInput,
  type TextInputProps,
  type TextProps,
  type TextStyle,
} from 'react-native';

/**
 * Text in Inter, simplytk.com's typeface. A custom font picks its weight by family, not by
 * `fontWeight`, so these read the weight from the style and choose the matching face.
 * Use them instead of React Native's Text and TextInput everywhere in the app.
 */
export const Fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
} as const;

export function interFor(weight: TextStyle['fontWeight']): string {
  switch (String(weight ?? '400')) {
    case '500':
      return Fonts.medium;
    case '600':
      return Fonts.semibold;
    case '700':
    case 'bold':
      return Fonts.bold;
    case '800':
    case '900':
      return Fonts.extrabold;
    default:
      return Fonts.regular;
  }
}

function withInter<S extends TextStyle>(style: S | undefined): TextStyle {
  const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  // A style that names its own face (a monospace timer, say) keeps it.
  if (flat.fontFamily) return flat;
  const { fontWeight, ...rest } = flat;
  return { ...rest, fontFamily: interFor(fontWeight) };
}

export function Text({ style, ...props }: TextProps) {
  return <NativeText {...props} style={withInter(style as TextStyle)} />;
}

export function TextInput({ style, ...props }: TextInputProps) {
  return <NativeTextInput {...props} style={withInter(style as TextStyle)} />;
}
