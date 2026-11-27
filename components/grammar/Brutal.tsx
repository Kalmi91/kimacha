import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, View, type AccessibilityState, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Text } from '@/components/KText';

import Colors from '@/constants/Colors';
import { useSkinDecor } from '@/components/skins';
import type { SkinDecor } from '@/components/skins/types';
import { ON_FILL } from '@/constants/GrammarPalettes';
import type { ColorRole, CornerRadii, SkinShape } from '@/constants/Skins';
import { useGrammarColors, type GrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import { gradientStyle } from '@/lib/gradientStyle';
import GradientFill, { mixHex } from '@/components/GradientFill';
import { useSkin } from '@/lib/useSkin';
import { useTheme } from '@/lib/ThemeContext';

// the neo-brutalist form elements.
// We only use them when useGrammarColors().brutal is true; the classic
// palette gives today's look, without these.

// 'ok' is the right-answer green (the theme's success fill), 'b' stays the accent for explanations.
export type BrutalFill = 'paper' | 'a' | 'b' | 'ink' | 'ok';

// The Neo-brutal shadow offset (px): the `offset` prop is scaled relative to it onto the theme's shadowOffset.
const BRUTAL_SHADOW = 3;

function fillColor(g: GrammarColors, fill: BrutalFill, ok: string = Colors.light.successFill): string {
  if (fill === 'ok') return ok;
  if (fill === 'a') return g.a;
  if (fill === 'b') return g.b;
  if (fill === 'ink') return g.ink;
  return g.paper;
}

// The text colour on the given fill: on a coloured (a / b) fill onA / onB (always onFill on the
// brutal theme), on tint the paper base, on paper the ink.
export function textOnFill(g: GrammarColors, fill: BrutalFill): string {
  if (fill === 'ok') return ON_FILL;
  if (fill === 'a') return g.onA;
  if (fill === 'b') return g.onB;
  if (fill === 'ink') return g.bg;
  return g.ink;
}

// The text of the main button (ink fill): in Neo-brutal light mode the b colour, in dark mode (where
// the ink is light) the dark base so that it stays readable (grammarColorsFor onInk); on the other themes the bg.
export function inkButtonText(g: GrammarColors): string {
  return g.onInk;
}

// the form roles (border / shadow colour) and the corner radius from the theme's `shape`.
export function roleColor(g: GrammarColors, role: ColorRole = 'ink'): string {
  if (role === 'a') return g.a;
  if (role === 'b') return g.b;
  if (role === 'c') return g.c;
  if (role === 'border') return g.border;
  return g.ink;
}

export function radiusStyle(r: number | CornerRadii): ViewStyle {
  if (typeof r === 'number') return r > 0 ? { borderRadius: r } : {};
  return { borderTopLeftRadius: r[0], borderTopRightRadius: r[1], borderBottomRightRadius: r[2], borderBottomLeftRadius: r[3] };
}

// Border width and corner of small elements (sticker, segment, switch): the theme's border, but at
// most today's 2 px, and the `maxRadius`; the Neo-brutal theme's current values (2 px, corner 0) are unchanged.
function smallRadius(shape: SkinShape, maxRadius: number): ViewStyle {
  return typeof shape.buttonRadius === 'number' ? radiusStyle(Math.min(shape.buttonRadius, maxRadius)) : {};
}

// the theme's button variant (from the decor). 'default' by default: nothing changes.
// stacked (senior): full width, at least 48 high; text (zen): text only; bevel (retro95):
// the first letter of the button underlined (the 3D edge comes from the form's `bevel` flag).
type ButtonVariant = NonNullable<SkinDecor['buttonVariant']>;

export function useButtonVariant(): ButtonVariant {
  return useSkinDecor().buttonVariant ?? 'default';
}

// The text colour of the push button: in the text-only variant (zen) the ink, otherwise according to the fill.
export function actionTextColor(g: GrammarColors, fill: BrutalFill, variant: ButtonVariant): string {
  if (variant === 'text') return g.ink;
  return fill === 'ink' ? inkButtonText(g) : textOnFill(g, fill);
}

function minHeightOf(style: StyleProp<ViewStyle>): number {
  const h = StyleSheet.flatten(style)?.minHeight;
  return typeof h === 'number' ? h : 0;
}

// retro95: the colours of the four sides of the 3D edge (light top-left, dark bottom-right); the theme's
// extra colour, with other colours (My mix) the Win95 defaults.
function bevelColors(g: GrammarColors): ViewStyle {
  const light = g.extra.bevelLight ?? '#FFFFFF';
  const dark = g.extra.bevelDark ?? '#808080';
  return { borderTopColor: light, borderLeftColor: light, borderBottomColor: dark, borderRightColor: dark };
}

// Box: on the Neo-brutal theme a 2.5 px ink border, corner 0, a solid offset shadow (3 px right + 3 px down,
// ink colour, no blur). In RN not elevation/shadow*: an ink-coloured
// back View, offset behind the box. Locked (dashed) box: dashed border,
// no shadow. The border width / style / colour, the corner and the shadow
// offset + colour come from the active theme's `shape` (the `offset` is scaled relative to the 3 px base).
export function BrutalBox({
  children,
  fill = 'paper',
  dashed = false,
  offset = 3,
  kind = 'card',
  style,
  boxStyle,
  onPress,
  disabled,
  action = false,
  testID,
  accessibilityLabel,
  accessibilityState,
}: {
  children?: ReactNode;
  fill?: BrutalFill;
  dashed?: boolean;
  offset?: number;
  // 'button': the button corner (shape.buttonRadius), 'card': the card corner (shape.radius).
  kind?: 'card' | 'button';
  // The style of the outer (layout) wrapper.
  style?: StyleProp<ViewStyle>;
  // The style of the front box (padding, alignment).
  boxStyle?: StyleProp<ViewStyle>;
  onPress?: () => void;
  disabled?: boolean;
  // push button (BrutalButton, the Knew it / Didn't know buttons): the theme's button variant applies to it.
  action?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityState?: AccessibilityState;
}) {
  const g = useGrammarColors();
  const { theme } = useTheme();
  const { shape } = useSkin().skin;
  const variant = useButtonVariant();
  const textOnly = action && variant === 'text';
  const wide = action && variant === 'stacked';
  const radius = radiusStyle(kind === 'button' ? shape.buttonRadius : shape.radius);
  const borderRole = (kind === 'button' && fill === 'paper' && shape.secondaryBorderColor) || shape.borderColor;
  const shift = textOnly ? 0 : (offset * shape.shadowOffset) / BRUTAL_SHADOW;
  const front: StyleProp<ViewStyle> = [
    {
      backgroundColor: textOnly ? 'transparent' : fillColor(g, fill, Colors[theme].successFill),
      borderWidth: textOnly ? 0 : shape.borderWidth,
      borderColor: roleColor(g, borderRole),
      borderStyle: dashed || shape.borderStyle === 'dashed' ? 'dashed' : 'solid',
      ...radius,
      ...(shape.bevel && !dashed && !textOnly ? bevelColors(g) : null),
    },
    boxStyle,
    wide ? { minHeight: Math.max(48, minHeightOf(boxStyle)) } : null,
  ];
  return (
    <View style={[{ marginRight: shift, marginBottom: shift }, wide ? { alignSelf: 'stretch' } : null, style]}>
      {dashed || shift <= 0 ? null : (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: shift,
            top: shift,
            right: -shift,
            bottom: -shift,
            backgroundColor: roleColor(g, shape.shadowColor),
            ...radius,
          }}
        />
      )}
      {onPress ? (
        <Pressable
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityState={accessibilityState}
          disabled={disabled}
          onPress={onPress}
          style={front}
        >
          {children}
        </Pressable>
      ) : (
        <View testID={testID} accessibilityLabel={accessibilityLabel} style={front}>
          {children}
        </View>
      )}
    </View>
  );
}

// Sticker: 2 px border, small letters, weight 500, rotated between -6° and +8°
// (streak, CORE, DONE, combo).
export function Sticker({
  label,
  fill = 'a',
  rotate = -4,
  style,
  textStyle,
  testID,
}: {
  label: string;
  fill?: BrutalFill;
  rotate?: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  testID?: string;
}) {
  const g = useGrammarColors();
  const { shape } = useSkin().skin;
  return (
    <View
      testID={testID}
      style={[
        styles.sticker,
        {
          backgroundColor: fillColor(g, fill),
          borderColor: roleColor(g, shape.borderColor),
          borderWidth: Math.min(2, shape.borderWidth),
          transform: [{ rotate: `${rotate}deg` }],
          ...smallRadius(shape, 999),
        },
        style,
      ]}
    >
      <Text style={[styles.stickerText, { color: textOnFill(g, fill) }, softTitleStyle(g), textStyle]}>{label}</Text>
    </View>
  );
}

// Lesson card: on the brutalist palette a BrutalBox (with paper or b fill), on the classic
// palette today's plain card (classicStyle + paper = today's card colour).
export function Card({
  children,
  fill = 'paper',
  style,
  classicStyle,
  boxStyle,
  testID,
}: {
  children?: ReactNode;
  fill?: BrutalFill;
  style?: StyleProp<ViewStyle>;
  classicStyle?: StyleProp<ViewStyle>;
  // the inner style of the brutalist box (after the default styles.card).
  boxStyle?: StyleProp<ViewStyle>;
  // Only goes on the brutalist box (the classic branch gets no testID).
  testID?: string;
}) {
  const g = useGrammarColors();
  if (g.brutal) {
    return (
      <BrutalBox testID={testID} fill={fill} style={style} boxStyle={[styles.card, boxStyle]}>
        {children}
      </BrutalBox>
    );
  }
  return <View style={[{ backgroundColor: g.paper }, classicStyle, style]}>{children}</View>;
}

// the main button (uppercase, weight 500): ink fill with b / bg coloured text, or
// a / b fill with #111 text.
export function BrutalButton({
  label,
  onPress,
  fill = 'ink',
  disabled,
  testID,
  accessibilityLabel,
  style,
  boxStyle,
  icon,
}: {
  label: string;
  onPress: () => void;
  fill?: BrutalFill;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  boxStyle?: StyleProp<ViewStyle>;
  // the icon placed before the label on the senior (stacked) theme; not shown on other themes.
  icon?: string;
}) {
  const g = useGrammarColors();
  const variant = useButtonVariant();
  // zen: the text of the main (the a-filled, "Knew it") button underlined; retro95: the first
  // letter of the button underlined.
  const underlineAll = variant === 'text' && fill === 'a';
  const softLabel = softTitleStyle(g);
  const text =
    variant === 'bevel' && label ? (
      <>
        <Text style={styles.underline}>{label.charAt(0)}</Text>
        {label.slice(1)}
      </>
    ) : variant === 'stacked' && icon && !label.includes(icon) ? (
      `${icon}  ${label}`
    ) : (
      label
    );
  return (
    <BrutalBox
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      fill={fill}
      kind="button"
      action
      disabled={disabled}
      onPress={onPress}
      style={[disabled ? { opacity: 0.4 } : null, style]}
      boxStyle={[styles.button, boxStyle]}
    >
      <Text
        style={[
          styles.buttonText,
          { color: actionTextColor(g, fill, variant) },
          softLabel,
          underlineAll ? styles.underline : null,
        ]}
      >
        {text}
      </Text>
    </BrutalBox>
  );
}

// Night skin (g.soft): titles / button labels drop the uppercase + weight 500 of the brutalist look.
export function softTitleStyle(g: GrammarColors): TextStyle | null {
  return g.soft ? { textTransform: 'none', fontWeight: '600' } : null;
}

// Night skin: small labels / section titles drop the uppercase and the letter spacing (weight stays).
export function softCaseStyle(g: GrammarColors): TextStyle | null {
  return g.soft ? { textTransform: 'none', letterSpacing: 0 } : null;
}

// Night skin: a rounded 1 px edge instead of the square 2-2.5 px ink edge.
export function softEdgeStyle(g: GrammarColors, radius?: number): ViewStyle | null {
  return g.soft ? { borderRadius: radius ?? g.soft.radius, borderWidth: 1, borderColor: g.border } : null;
}

// input field on the brutalist palette: 2.5 px ink border, corner 0, paper background.
export function brutalInputStyle(g: GrammarColors): TextStyle {
  // the theme's own input-field colour (retro95: white "field"), if it has one; otherwise the paper.
  if (g.soft) return { borderWidth: 1, borderColor: g.border, borderRadius: g.soft.radius, backgroundColor: g.bg, color: g.ink };
  return { borderWidth: 2.5, borderColor: g.ink, borderRadius: 0, backgroundColor: g.extra.field ?? g.paper, color: g.ink };
}

const DOCK_PAD_BRUTAL: ViewStyle = { paddingBottom: 130 };

// The scroll content's bottom padding that clears the docked action button on the brutalist palette.
export function themedDockPad(g: GrammarColors): ViewStyle | null {
  return g.brutal ? DOCK_PAD_BRUTAL : null;
}

// The secondary text colour: the theme's `mu` on the brutalist palette, the classic muted colour otherwise.
export function mutedColor(g: GrammarColors, classic: string): string {
  return g.brutal ? g.mu : classic;
}

// switch. On the brutalist palette a rectangular track (2.5 px ink border, corner 0), a square
// ink knob, when on the track has the `a` fill; on the classic palette today's Switch.
export function BrutalSwitch({
  value,
  onValueChange,
  disabled,
  testID,
  accessibilityLabel,
}: {
  value: boolean;
  onValueChange?: (value: boolean) => void;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const g = useGrammarColors();
  const { theme } = useTheme();
  const { shape } = useSkin().skin;
  if (!g.brutal) {
    return <Switch testID={testID} accessibilityLabel={accessibilityLabel} value={value} onValueChange={onValueChange} disabled={disabled} trackColor={{ false: Colors[theme].tabIconDefault, true: Colors[theme].tint }} />;
  }
  const round = smallRadius(shape, 14);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => onValueChange?.(!value)}
      style={[
        styles.switchTrack,
        {
          borderColor: roleColor(g, shape.borderColor),
          borderWidth: Math.max(1, shape.borderWidth),
          backgroundColor: value ? g.a : g.paper,
          ...round,
        },
        disabled ? { opacity: 0.4 } : null,
      ]}
    >
      <View
        style={[
          styles.switchThumb,
          { backgroundColor: g.ink },
          'borderRadius' in round ? { borderRadius: 999 } : null,
          value ? { right: 4 } : { left: 4 },
        ]}
      />
    </Pressable>
  );
}

// back arrow in the header row drawn into the screen: a small BrutalBox, ink arrow.
export function BrutalBackButton({ onPress, testID }: { onPress: () => void; testID?: string }) {
  const g = useGrammarColors();
  return (
    <BrutalBox testID={testID} accessibilityLabel={t().a11y.back} onPress={onPress} offset={2} kind="button" boxStyle={styles.backBox}>
      <Text style={[styles.backArrow, { color: g.ink }]}>←</Text>
    </BrutalBox>
  );
}

// How many blocks are filled in the segmented bar for a 0-100 percentage.
export function segmentsFilled(percent: number, segments: number): number {
  return Math.max(0, Math.min(segments, Math.round((percent / 100) * segments)));
}

// Segmented progress: 5-8 blocks, 9 px high, 2 px border, done block = ink fill.
export function SegmentBar({
  filled,
  segments = 6,
  style,
  testID,
}: {
  filled: number;
  segments?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const g = useGrammarColors();
  const { shape } = useSkin().skin;
  const { progressFill: from, progressFill2: to } = g.extra;
  // Night (progressFill2): a done block takes its colour from the pink-cyan run across the row; others stay ink.
  const doneColor = (i: number) => (from && to ? mixHex(from, to, segments > 1 ? i / (segments - 1) : 0) : g.ink);
  return (
    <View testID={testID} style={[styles.segmentRow, style]}>
      {Array.from({ length: segments }, (_, i) => (
        <View
          key={i}
          testID={testID ? `${testID}-${i}` : undefined}
          style={[
            styles.segment,
            {
              borderColor: roleColor(g, shape.borderColor),
              borderWidth: Math.min(2, shape.borderWidth),
              backgroundColor: i < filled ? doneColor(i) : 'transparent',
              ...smallRadius(shape, 4),
            },
          ]}
        />
      ))}
    </View>
  );
}

// Continuous progress: one track with the same border look as a SegmentBar block, the ink fill = pct (0-100).
// A theme with extra.progressTrack (night) gets a borderless filled track of shape.barHeight and fill extra.progressFill.
export function ContinuousBar({
  pct,
  style,
  testID,
  fillTestID,
}: {
  pct: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  fillTestID?: string;
}) {
  const g = useGrammarColors();
  const { shape } = useSkin().skin;
  const track = g.extra.progressTrack;
  return (
    <View
      testID={testID}
      style={[
        styles.continuousTrack,
        track
          ? { backgroundColor: track, ...(shape.barHeight ? { height: shape.barHeight } : null), ...radiusStyle(shape.barRadius ?? 0) }
          : { borderColor: roleColor(g, shape.borderColor), borderWidth: Math.min(2, shape.borderWidth), ...smallRadius(shape, 4) },
        style,
      ]}
    >
      <View
        testID={fillTestID}
        style={[
          { width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', backgroundColor: g.extra.progressFill ?? g.ink },
          g.extra.progressFill2 && g.extra.progressFill ? gradientStyle(g.extra.progressFill, g.extra.progressFill2) : null,
          g.extra.progressFill2 ? radiusStyle(shape.barRadius ?? 0) : null,
          g.extra.progressFill2 && g.extra.progressFill ? { overflow: 'hidden' } : null,
        ]}
      >
        {g.extra.progressFill2 && g.extra.progressFill ? (
          <GradientFill
            from={g.extra.progressFill}
            to={g.extra.progressFill2}
            testID={fillTestID ? `${fillTestID}-gradient` : undefined}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, gap: 6 },
  sticker: {
    alignSelf: 'flex-start',
    borderWidth: 2,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  stickerText: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  button: { minHeight: 44, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, fontWeight: '500', textTransform: 'uppercase' },
  underline: { textDecorationLine: 'underline' },
  switchTrack: { width: 52, height: 28, borderWidth: 2.5 },
  switchThumb: { position: 'absolute', top: 4, width: 15, height: 15 },
  backBox: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 20, fontWeight: '500' },
  segmentRow: { flexDirection: 'row', gap: 3 },
  continuousTrack: { height: 10, overflow: 'hidden' },
  segment: { flex: 1, height: 9, borderWidth: 2 },
});
