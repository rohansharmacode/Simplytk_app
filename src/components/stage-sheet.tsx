import { SymbolView } from 'expo-symbols';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { Radius, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { STAGE_LABELS, STAGES, type ApplicationStage } from '@/lib/applications/stages';

/**
 * Pick an application's stage, like the stage dropdown on simplytk.com, with the row's
 * other actions under it. A page sheet on iOS, a bottom sheet elsewhere.
 */
export function StageSheet({
  visible,
  title,
  subtitle,
  current,
  onPick,
  actions = [],
  onClose,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  /** The stage it's at, or null for an opening that isn't tracked yet. */
  current: ApplicationStage | null;
  onPick: (stage: ApplicationStage) => void;
  actions?: { label: string; destructive?: boolean; onPress: () => void }[];
  onClose: () => void;
}) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const ios = Platform.OS === 'ios';
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={ios ? 'pageSheet' : 'overFullScreen'}
      transparent={!ios}
      onRequestClose={onClose}>
      <View style={[styles.backdrop, !ios && { backgroundColor: 'rgba(0,0,0,0.35)' }]}>
        {!ios ? <Pressable accessibilityLabel="Close" style={StyleSheet.absoluteFill} onPress={onClose} /> : null}
        <View
          style={[
            styles.sheet,
            { backgroundColor: palette.background, paddingBottom: insets.bottom + Spacing.four },
            ios ? styles.fill : styles.bottom,
          ]}>
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]} numberOfLines={1}>
                {title}
              </Text>
              {subtitle ? (
                <Text style={[styles.subtitle, { color: palette.textSecondary }]} numberOfLines={2}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Done" hitSlop={10} onPress={onClose}>
              <Text style={[styles.done, { color: palette.tint }]}>Done</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body}>
            <Text style={[styles.kicker, { color: palette.textSecondary }]}>STAGE</Text>
            <View style={[styles.group, { backgroundColor: palette.surface, borderColor: palette.hair }]}>
              {STAGES.map((stage, index) => (
                <Pressable
                  key={stage}
                  accessibilityRole="button"
                  accessibilityState={{ selected: stage === current }}
                  onPress={() => onPick(stage)}
                  style={({ pressed }) => [
                    styles.option,
                    index > 0 && { borderTopColor: palette.hair, borderTopWidth: 1 },
                    pressed && { backgroundColor: palette.muted },
                  ]}>
                  <Text style={[styles.optionLabel, { color: palette.text }]}>{STAGE_LABELS[stage]}</Text>
                  {stage === current ? (
                    <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} tintColor={palette.tint} size={17} />
                  ) : null}
                </Pressable>
              ))}
            </View>
            {actions.length ? (
              <View style={[styles.group, { backgroundColor: palette.surface, borderColor: palette.hair }]}>
                {actions.map((action, index) => (
                  <Pressable
                    key={action.label}
                    accessibilityRole="button"
                    onPress={action.onPress}
                    style={({ pressed }) => [
                      styles.option,
                      index > 0 && { borderTopColor: palette.hair, borderTopWidth: 1 },
                      pressed && { backgroundColor: palette.muted },
                    ]}>
                    <Text style={[styles.optionLabel, { color: action.destructive ? palette.danger : palette.tint }]}>
                      {action.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    paddingTop: Spacing.four,
  },
  fill: {
    flex: 1,
  },
  bottom: {
    maxHeight: '85%',
    borderTopLeftRadius: Radius.card,
    borderTopRightRadius: Radius.card,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  done: {
    fontSize: 17,
    fontWeight: '600',
  },
  body: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  group: {
    borderRadius: Radius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    minHeight: 50,
  },
  optionLabel: {
    fontSize: 16,
  },
});
