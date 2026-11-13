import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useNavigation } from 'expo-router';
import { HeaderHeightContext, HeaderShownContext } from 'expo-router/react-navigation';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { createContext, Fragment, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  ScrollView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { cardShadow, Radius, Spacing, Tabular, toneColors, type Tone } from '@/constants/theme';
import { usePalette, useScheme } from '@/hooks/use-palette';

/**
 * The pieces every native screen is built from, in the style of Apple's own apps and the
 * Orbit app: iOS large titles with round Liquid Glass buttons, white cards with a soft
 * shadow, a blue hero card, coloured icon tiles and tinted action pills. Numbers are
 * tabular so counters don't jitter.
 */

export type Icon = { ios: SFSymbol; android: AndroidSymbol };

/** Room under the content for the floating tab bar. */
const BOTTOM_ROOM = Platform.OS === 'web' ? 112 : Spacing.six;

/** Lets a screen's large `Title` tell its `Screen` what to show in the small bar on scroll. */
const ScreenTitleContext = createContext<(title: string) => void>(() => {});

/** How far the large title scrolls before the small one takes over, as in Mail and Music. */
const TITLE_SWAP = 44;

export function Screen({
  children,
  refreshing,
  onRefresh,
  footer,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Pinned under the scrolling content, e.g. your own leaderboard row. */
  footer?: ReactNode;
}) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const headerShown = useContext(HeaderShownContext);
  const headerHeight = useContext(HeaderHeightContext) ?? 0;
  // Under a navigation bar the system does the large title and the frosting (header-options.ts);
  // a screen without one (a full-screen modal) gets the same look from TopBar.
  const underHeader = headerShown && headerHeight > 0;
  const [title, setTitle] = useState('');
  const [scrollY] = useState(() => new Animated.Value(0));

  // iOS starts the scroll view pulled down by the top inset it adds, so 0 is not the top.
  const top = Platform.OS === 'ios' ? -insets.top : 0;
  // Android doesn't inset content under the status bar itself.
  const topPad = Platform.OS === 'android' && !underHeader ? insets.top : 0;

  const onScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true });

  const scroll = (
    <Animated.ScrollView
      style={{ flex: 1, backgroundColor: palette.background }}
      contentContainerStyle={[styles.content, { paddingTop: topPad + Spacing.three, paddingBottom: BOTTOM_ROOM }]}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      // The AI tools' answer boxes stay above the keyboard on iOS.
      automaticallyAdjustKeyboardInsets
      onScroll={underHeader ? undefined : onScroll}
      scrollEventThrottle={16}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={!!refreshing}
            onRefresh={onRefresh}
            tintColor={palette.textSecondary}
            progressViewOffset={topPad}
          />
        ) : undefined
      }>
      {children}
    </Animated.ScrollView>
  );

  // The navigation bar only follows a scroll view that is the screen's own root view: wrapped
  // in another view, the large title stays put and the bar never frosts.
  if (underHeader && !footer) {
    return <ScreenTitleContext.Provider value={setTitle}>{scroll}</ScreenTitleContext.Provider>;
  }

  return (
    <ScreenTitleContext.Provider value={setTitle}>
      <View style={{ flex: 1, backgroundColor: palette.background }}>
        {scroll}
        {underHeader ? null : <TopBar title={title} scrollY={scrollY} top={top} height={insets.top} />}
        {footer ? <View style={{ paddingBottom: Platform.OS === 'web' ? 96 : 0 }}>{footer}</View> : null}
      </View>
    </ScreenTitleContext.Provider>
  );
}

/**
 * The frosted bar over a tab's status bar area. It is clear at the top of the page, frosts
 * as content slides under it, and shows the page's title small once the large one is gone,
 * so nothing scrolls hard into the notch.
 */
function TopBar({
  title,
  scrollY,
  top,
  height,
}: {
  title: string;
  scrollY: Animated.Value;
  top: number;
  height: number;
}) {
  const palette = usePalette();
  const scheme = useScheme();
  const frost = scrollY.interpolate({
    inputRange: [top, top + 16],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const label = scrollY.interpolate({
    inputRange: [top + TITLE_SWAP - 8, top + TITLE_SWAP + 12],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  return (
    <View pointerEvents="none" style={[styles.topBar, { height: height + 44 }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: frost }]}>
        {Platform.OS === 'ios' ? (
          <BlurView
            tint={scheme === 'dark' ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
            intensity={100}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.surface }]} />
        )}
        <View style={[styles.topBarEdge, { backgroundColor: palette.hair }]} />
      </Animated.View>
      <Animated.View style={[styles.topBarTitle, { top: height, opacity: label }]}>
        <Text numberOfLines={1} style={[styles.topBarText, { color: palette.text }]}>
          {title}
        </Text>
      </Animated.View>
    </View>
  );
}

/** A small uppercase label: the date over a title, or a label on a card. */
export function Kicker({ children, color }: { children: ReactNode; color?: string }) {
  const palette = usePalette();
  return <Text style={[styles.kicker, { color: color ?? palette.textSecondary }]}>{children}</Text>;
}

/**
 * An iOS large title. `eyebrow` is the small line above it (Orbit puts the date there),
 * `actions` the round glass buttons on its right.
 */
export function Title({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  const palette = usePalette();
  const navigation = useNavigation();
  const headerShown = useContext(HeaderShownContext);
  const setScreenTitle = useContext(ScreenTitleContext);
  useEffect(() => setScreenTitle(title), [setScreenTitle, title]);

  // Under a navigation bar the title is the system's large title and the buttons sit in the
  // bar, as in Music and Mail; only the small lines stay in the page.
  useLayoutEffect(() => {
    if (!headerShown) return;
    navigation.setOptions({
      title,
      headerLargeTitleEnabled: true,
      headerRight: actions
        ? () => (
            <InHeaderContext.Provider value>
              <View style={styles.headerActions}>{actions}</View>
            </InHeaderContext.Provider>
          )
        : undefined,
    });
  }, [navigation, headerShown, title, actions]);

  if (headerShown) {
    const line = [eyebrow, subtitle].filter(Boolean);
    if (!line.length) return null;
    return (
      <View style={styles.titleBlock}>
        {eyebrow ? <Kicker>{eyebrow}</Kicker> : null}
        {subtitle ? <Text style={[styles.subtitle, { color: palette.textSecondary }]}>{subtitle}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.titleRow}>
      <View style={styles.titleBlock}>
        {eyebrow ? <Kicker>{eyebrow}</Kicker> : null}
        <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>
          {title}
        </Text>
        {subtitle ? <Text style={[styles.subtitle, { color: palette.textSecondary }]}>{subtitle}</Text> : null}
      </View>
      {actions ? <View style={styles.titleActions}>{actions}</View> : null}
    </View>
  );
}

/** Tells a GlassButton it sits in the navigation bar, which draws its own glass on iOS 26. */
const InHeaderContext = createContext(false);

/**
 * A round toolbar button. On iOS 26 it is real Liquid Glass; elsewhere a frosted circle
 * with a soft shadow.
 */
export function GlassButton({ icon, label, onPress }: { icon: Icon; label: string; onPress: () => void }) {
  const palette = usePalette();
  const inHeader = useContext(InHeaderContext);
  const glyph = <SymbolView name={{ ...icon, web: icon.android }} tintColor={palette.tint} size={inHeader ? 22 : 19} />;
  if (inHeader) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        hitSlop={8}
        onPress={onPress}
        style={styles.headerButton}>
        {glyph}
      </Pressable>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => pressed && { transform: [{ scale: 0.94 }] }}>
      {isLiquidGlassAvailable() ? (
        <GlassView glassEffectStyle="regular" isInteractive style={styles.glassButton}>
          {glyph}
        </GlassView>
      ) : (
        <View
          style={[
            styles.glassButton,
            {
              backgroundColor: palette.glass,
              borderColor: palette.hair,
              borderWidth: 1,
            },
            cardShadow(palette.shadow),
          ]}>
          {glyph}
        </View>
      )}
    </Pressable>
  );
}

/** Colours for text on the blue hero card. */
export const onHero = {
  text: '#FFFFFF',
  secondary: 'rgba(255,255,255,0.82)',
  faint: 'rgba(255,255,255,0.5)',
  line: 'rgba(255,255,255,0.12)',
  fill: 'rgba(255,255,255,0.12)',
};

/** The blue card at the top of a tab, in the logo's colour. */
export function Hero({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const palette = usePalette();
  return (
    <LinearGradient
      colors={[palette.heroFrom, palette.heroTo]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.hero, style]}>
      <View pointerEvents="none" style={styles.heroGlow} />
      {children}
    </LinearGradient>
  );
}

/** A row of numbers along the bottom of the hero card. */
export function HeroStats({ stats }: { stats: { value: string; label: string; color?: string }[] }) {
  return (
    <View style={[styles.heroStats, { borderTopColor: onHero.line }]}>
      {stats.map((stat) => (
        <View key={stat.label} style={styles.heroStat}>
          <Text style={[styles.heroStatValue, Tabular, { color: stat.color ?? onHero.text }]}>{stat.value}</Text>
          <Text style={[styles.heroStatLabel, { color: onHero.secondary }]} numberOfLines={1}>
            {stat.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** A section title with a small coloured tile, a count and a "See all" link, as in Orbit. */
export function SectionHeader({
  title,
  icon,
  tone = 'blue',
  count,
  action,
}: {
  title: string;
  icon?: Icon;
  tone?: Tone;
  count?: number;
  action?: { label: string; onPress: () => void };
}) {
  const palette = usePalette();
  // Music and the App Store: a bold title, and when there's more to see, a chevron after it
  // and the whole header tappable. The icon and tone are kept for callers but not drawn.
  void icon;
  void tone;
  const head = (
    <View style={styles.sectionHeader}>
      <Text accessibilityRole="header" style={[styles.sectionTitle, { color: palette.text }]} numberOfLines={1}>
        {title}
      </Text>
      {count != null && count > 0 ? (
        <Text style={[styles.sectionCount, Tabular, { color: palette.textSecondary }]}>{count}</Text>
      ) : null}
      {action ? <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} tintColor={palette.textSecondary} size={15} weight="bold" /> : null}
    </View>
  );
  if (!action) return head;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${action.label}`}
      onPress={action.onPress}
      style={({ pressed }) => pressed && { opacity: 0.5 }}>
      {head}
    </Pressable>
  );
}

/**
 * A row of cards you swipe sideways, as in Music and the App Store. It runs to the screen's
 * edges and snaps to each card.
 */
export function Carousel({ children, itemWidth }: { children: ReactNode; itemWidth: number }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={itemWidth + Spacing.three}
      snapToAlignment="start"
      style={styles.carousel}
      contentContainerStyle={styles.carouselContent}>
      {children}
    </ScrollView>
  );
}

export function Card({
  children,
  onPress,
  style,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const palette = usePalette();
  const base = [
    styles.card,
    { backgroundColor: palette.surface, borderColor: palette.hair },
    cardShadow(palette.shadow),
    style,
  ];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [base, pressed && { transform: [{ scale: 0.985 }] }]}>
      {children}
    </Pressable>
  );
}

/** An inset grouped list, like Settings: rows in one card with hairlines between them. */
export function Group({ children }: { children: ReactNode[] }) {
  const palette = usePalette();
  const rows = children.filter(Boolean);
  return (
    <View
      style={[
        styles.group,
        { backgroundColor: palette.surface, borderColor: palette.hair },
        cardShadow(palette.shadow),
      ]}>
      {rows.map((row, index) => (
        <Fragment key={index}>
          {index > 0 ? <View style={[styles.separator, { backgroundColor: palette.hair }]} /> : null}
          {row}
        </Fragment>
      ))}
    </View>
  );
}

/** One row of a Group: a coloured tile, a title and subtitle, and a pill or a chevron. */
export function Row({
  icon,
  leading,
  tone = 'blue',
  title,
  subtitle,
  pill,
  chevron,
  onPress,
}: {
  icon?: Icon;
  /** Shown in place of the icon tile, e.g. a firm's logo. */
  leading?: ReactNode;
  tone?: Tone;
  title: string;
  subtitle?: string;
  pill?: { label: string; tone?: Tone; onPress?: () => void };
  chevron?: boolean;
  onPress?: () => void;
}) {
  const palette = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: palette.muted }]}>
      {leading ?? (icon ? <IconTile icon={icon} tone={tone} /> : null)}
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.rowSubtitle, { color: palette.textSecondary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {pill ? <Pill label={pill.label} tone={pill.tone ?? tone} onPress={pill.onPress ?? onPress} /> : null}
      {chevron ? (
        <SymbolView
          name={{
            ios: 'chevron.right',
            android: 'chevron_right',
            web: 'chevron_right',
          }}
          tintColor={palette.faint}
          size={13}
        />
      ) : null}
    </Pressable>
  );
}

/** A tinted action pill: "Apply", "Play", "Prepare". */
export function Pill({ label, tone = 'blue', onPress }: { label: string; tone?: Tone; onPress?: () => void }) {
  const palette = usePalette();
  const colors = toneColors(palette, tone);
  return (
    <Pressable
      accessibilityRole="button"
      disabled={!onPress}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.pill, { backgroundColor: colors.bg }, pressed && { opacity: 0.7 }]}>
      <Text style={[styles.pillLabel, { color: colors.fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  busy,
  icon,
}: {
  label: string;
  onPress: () => void;
  /** `onHero` is the white button on the blue hero card. */
  variant?: 'primary' | 'secondary' | 'onHero';
  disabled?: boolean;
  busy?: boolean;
  icon?: Icon;
}) {
  const palette = usePalette();
  const color = variant === 'primary' ? palette.onTint : variant === 'onHero' ? '#2B54E8' : palette.tint;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || !!busy, busy: !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && { backgroundColor: palette.tint },
        variant === 'secondary' && { backgroundColor: palette.tintSoft },
        variant === 'onHero' && { backgroundColor: '#FFFFFF' },
        (disabled || busy) && { opacity: 0.5 },
        pressed && { transform: [{ scale: 0.97 }] },
      ]}>
      {busy ? (
        <ActivityIndicator color={color} />
      ) : (
        <>
          {icon ? <SymbolView name={{ ...icon, web: icon.android }} tintColor={color} size={17} /> : null}
          <Text style={[styles.buttonLabel, { color }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

/** A filter pill: grey when off, filled blue when on. */
export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const palette = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected
          ? { backgroundColor: palette.tint }
          : [
              {
                backgroundColor: palette.surface,
                borderColor: palette.hair,
                borderWidth: 1,
              },
              cardShadow(palette.shadow),
            ],
        pressed && { opacity: 0.7 },
      ]}>
      <Text style={[styles.chipLabel, { color: selected ? palette.onTint : palette.text }]}>{label}</Text>
    </Pressable>
  );
}

/** The iOS segmented control: a grey track with the chosen option raised in white. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly (readonly [T, string])[];
  value: T;
  onChange: (value: T) => void;
}) {
  const palette = usePalette();
  return (
    <View accessibilityRole="tablist" style={[styles.segmented, { backgroundColor: palette.raised }]}>
      {options.map(([option, label]) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option)}
            style={[styles.segment, selected && [{ backgroundColor: palette.surface }, cardShadow(palette.shadow)]]}>
            <Text
              numberOfLines={1}
              style={[styles.segmentLabel, { color: selected ? palette.text : palette.textSecondary }]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A big number with a small caption, e.g. the streak. */
export function Stat({ value, label, color }: { value: string; label: string; color?: string }) {
  const palette = usePalette();
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, Tabular, { color: color ?? palette.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: palette.textSecondary }]}>{label}</Text>
    </View>
  );
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  const palette = usePalette();
  return (
    <Card style={styles.empty}>
      <Text style={[styles.emptyTitle, { color: palette.text }]}>{title}</Text>
      {body ? <Text style={[styles.body, { color: palette.textSecondary }]}>{body}</Text> : null}
      {action}
    </Card>
  );
}

export function Loading() {
  const palette = usePalette();
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={palette.textSecondary} />
    </View>
  );
}

/**
 * simplytk.com's header logo: the dumbbell mark (public/favicon.svg on the site, drawn here
 * at its proportions) and the wordmark with "tk" in blue.
 */
export function Wordmark({ size = 22 }: { size?: number }) {
  const palette = usePalette();
  const u = size / 22; // the mark is 32 × 18 at size 22
  return (
    <View accessible accessibilityLabel="simplytk" style={styles.wordmark}>
      <View style={{ width: 32 * u, height: 18 * u, justifyContent: 'center' }}>
        <View
          style={{
            position: 'absolute',
            left: 4 * u,
            right: 4 * u,
            height: 7.6 * u,
            borderRadius: 3.8 * u,
            backgroundColor: palette.tint,
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: 0,
            width: 10.2 * u,
            height: 17.8 * u,
            borderRadius: 3.8 * u,
            backgroundColor: palette.tint,
          }}
        />
        <View
          style={{
            position: 'absolute',
            right: 0,
            width: 10.2 * u,
            height: 17.8 * u,
            borderRadius: 3.8 * u,
            backgroundColor: palette.tint,
          }}
        />
      </View>
      <Text style={[styles.wordmarkText, { fontSize: size, color: palette.text }]}>
        simply<Text style={{ color: palette.tint }}>tk</Text>
      </Text>
    </View>
  );
}

/** A rounded square with a symbol on a soft tint of its colour. */
export function IconTile({ icon, tone = 'blue', size = 36 }: { icon: Icon; tone?: Tone; size?: number }) {
  const palette = usePalette();
  const colors = toneColors(palette, tone);
  return (
    <View
      style={[
        styles.iconTile,
        {
          width: size,
          height: size,
          borderRadius: size * 0.3,
          backgroundColor: colors.bg,
        },
      ]}>
      <SymbolView name={{ ...icon, web: icon.android }} tintColor={colors.fg} size={size * 0.5} />
    </View>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  headerButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  topBarEdge: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
  },
  topBarTitle: {
    position: 'absolute',
    left: Spacing.six * 2,
    right: Spacing.six * 2,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarText: {
    fontSize: 17,
    fontWeight: '600',
  },
  content: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.five,
  },
  kicker: {
    fontSize: 12,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.three,
  },
  titleBlock: {
    flex: 1,
    gap: 4,
  },
  titleActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingBottom: 2,
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
  },
  glassButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  hero: {
    borderRadius: 24,
    padding: Spacing.four,
    gap: Spacing.four,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    top: -60,
    right: -70,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  heroStats: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: Spacing.three,
  },
  heroStat: {
    flex: 1,
    gap: 1,
  },
  heroStatValue: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  heroStatLabel: {
    fontSize: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: -Spacing.two,
  },
  sectionIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
    flexShrink: 1,
  },
  sectionCount: {
    fontSize: 17,
    fontWeight: '600',
  },
  carousel: {
    marginHorizontal: -Spacing.four,
  },
  carouselContent: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  count: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sectionAction: {
    fontSize: 15,
    fontWeight: '600',
  },
  card: {
    borderRadius: Radius.card,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  group: {
    borderRadius: Radius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  separator: {
    height: 1,
    marginLeft: Spacing.four + 36 + Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    minHeight: 60,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  rowSubtitle: {
    fontSize: 13,
  },
  pill: {
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    minHeight: 32,
    justifyContent: 'center',
  },
  pillLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  button: {
    minHeight: 50,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.five,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  chip: {
    minHeight: 34,
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
  },
  segment: {
    flex: 1,
    minHeight: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  segmentLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  stat: {
    gap: 2,
  },
  statValue: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  statLabel: {
    fontSize: 13,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.five,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
  loading: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
  },
  wordmark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wordmarkText: {
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  iconTile: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
