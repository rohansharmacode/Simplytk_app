import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Text, TextInput } from '@/components/text';
import { Card, Chip, Kicker } from '@/components/ui';
import { Spacing, Tabular, toneColors, type Tone } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { scoreTone } from '@/lib/ai-tools';
import { copyText } from '@/lib/open';

/** A labelled text box. Multiline boxes grow to `minHeight`. */
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  minHeight = 110,
  hint,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  minHeight?: number;
  hint?: string;
  keyboardType?: 'default' | 'number-pad';
}) {
  const palette = usePalette();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: palette.textSecondary }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholder={placeholder}
        placeholderTextColor={palette.faint}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        keyboardType={keyboardType}
        style={[
          styles.input,
          { color: palette.text, backgroundColor: palette.raised },
          multiline && { minHeight, textAlignVertical: 'top', paddingTop: Spacing.three },
        ]}
      />
      {hint ? <Text style={[styles.hint, { color: palette.faint }]}>{hint}</Text> : null}
    </View>
  );
}

/** A labelled row of chips to pick one option from, scrolling sideways when long. */
export function Picker<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  const palette = usePalette();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: palette.textSecondary }]}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {options.map((option) => (
          <Chip key={option.key} label={option.label} selected={option.key === value} onPress={() => onChange(option.key)} />
        ))}
      </ScrollView>
    </View>
  );
}

/** A big score with its scale, coloured by how good it is. */
export function ScoreBadge({ score, outOf, caption }: { score: number; outOf: number; caption?: string }) {
  const palette = usePalette();
  const colors = toneColors(palette, scoreTone(score, outOf));
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.score, Tabular, { color: colors.fg }]}>
        {score}
        <Text style={[styles.outOf, { color: colors.fg }]}>{`/${outOf}`}</Text>
      </Text>
      {caption ? <Text style={[styles.caption, { color: colors.fg }]}>{caption}</Text> : null}
    </View>
  );
}

/** A titled list of short points, ticked or flagged. */
export function Points({ title, points, tone = 'blue' }: { title: string; points: string[]; tone?: Tone }) {
  const palette = usePalette();
  if (!points.length) return null;
  const colors = toneColors(palette, tone);
  const icon =
    tone === 'green'
      ? { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }
      : tone === 'red' || tone === 'amber'
        ? { ios: 'arrow.up.circle.fill', android: 'arrow_circle_up', web: 'arrow_circle_up' }
        : { ios: 'circle.fill', android: 'circle', web: 'circle' };
  return (
    <Card style={styles.card}>
      <Kicker>{title}</Kicker>
      {points.map((point, index) => (
        <View key={`${index}-${point.slice(0, 20)}`} style={styles.point}>
          <SymbolView name={icon as never} tintColor={colors.fg} size={tone === 'blue' ? 7 : 16} style={styles.pointIcon} />
          <Text style={[styles.body, { color: palette.text }]}>{point}</Text>
        </View>
      ))}
    </Card>
  );
}

/** A before and after rewrite, with why it's better. */
export function Rewrite({ original, improved, why }: { original: string; improved: string; why?: string }) {
  const palette = usePalette();
  return (
    <Card style={styles.card}>
      <Text style={[styles.body, styles.struck, { color: palette.textSecondary }]}>{original}</Text>
      <Text style={[styles.body, styles.strong, { color: palette.text }]}>{improved}</Text>
      {why ? <Text style={[styles.hint, { color: palette.textSecondary }]}>{why}</Text> : null}
    </Card>
  );
}

/** A block of generated text the student will take away, with a copy button. */
export function Copyable({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  const palette = usePalette();
  return (
    <Card style={styles.card}>
      <View style={styles.copyHead}>
        <Kicker>{title}</Kicker>
        <Text
          accessibilityRole="button"
          onPress={() => void copyText(text)}
          style={[styles.copy, { color: palette.tint }]}>
          Copy
        </Text>
      </View>
      <Text selectable style={[styles.body, { color: palette.text }]}>
        {text}
      </Text>
      {children}
    </Card>
  );
}

/** A quiet line under a form: today's allowance, a quick-run note, an error. */
export function Note({ text, tone }: { text: string | null | undefined; tone?: 'error' }) {
  const palette = usePalette();
  if (!text) return null;
  return <Text style={[styles.hint, { color: tone === 'error' ? palette.danger : palette.textSecondary }]}>{text}</Text>;
}

const styles = StyleSheet.create({
  field: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    minHeight: 46,
    fontSize: 16,
    lineHeight: 22,
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
  },
  chips: {
    gap: Spacing.two,
    paddingRight: Spacing.three,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  score: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
  },
  outOf: {
    fontSize: 17,
    fontWeight: '700',
  },
  caption: {
    fontSize: 13,
    fontWeight: '600',
  },
  card: {
    gap: Spacing.two,
  },
  point: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'flex-start',
  },
  pointIcon: {
    marginTop: 3,
  },
  body: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  struck: {
    textDecorationLine: 'line-through',
  },
  strong: {
    fontWeight: '600',
  },
  copyHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  copy: {
    fontSize: 14,
    fontWeight: '700',
  },
});
