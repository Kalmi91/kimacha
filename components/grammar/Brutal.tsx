import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Text } from '@/components/KText';

import Colors from '@/constants/Colors';
import { useSkinDecor } from '@/components/skins';
import type { SkinDecor } from '@/components/skins/types';
import type { ColorRole, CornerRadii, SkinShape } from '@/constants/Skins';
import { useGrammarColors, type GrammarColors } from '@/lib/grammarColors';
import { useSkin } from '@/lib/useSkin';
import { useTheme } from '@/lib/ThemeContext';

// the neo-brutalist form elements.
// We only use them when useGrammarColors().brutal is true; the classic
// palette gives today's look, without these.

export type BrutalFill = 'paper' | 'a' | 'b' | 'ink';

// The Neo-brutal shadow offset (px): the `offset` prop is scaled relative to it onto the theme's shadowOffset.
const BRUTAL_SHADOW = 3;

function fillColor(g: GrammarColors, fill: BrutalFill): string {
  if (fill === 'a') return g.a;
  if (fill === 'b') return g.b;
  if (fill === 'ink') return g.ink;
  return g.paper;
}

// The text colour on the given fill: on a coloured (a / b) fill onA / onB (always onFill on the
// brutal theme), on tint the paper base, on paper the ink.
export function textOnFill(g: GrammarColors, fill: BrutalFill): string {
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
}) {
  const g = useGrammarColors();
  const { shape } = useSkin().skin;
  const variant = useButtonVariant();
  const textOnly = action && variant === 'text';
  const wide = action && variant === 'stacked';
  const radius = radiusStyle(kind === 'button' ? shape.buttonRadius : shape.radius);
  const borderRole = (kind === 'button' && fill === 'paper' && shape.secondaryBorderColor) || shape.borderColor;
  const shift = textOnly ? 0 : (offset * shape.shadowOffset) / BRUTAL_SHADOW;
  const front: StyleProp<ViewStyle> = [
    {
      backgroundColor: textOnly ? 'transparent' : fillColor(g, fill),
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
          accessibilityLabel={accessibilityLabel}
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
      <Text style={[styles.stickerText, { color: textOnFill(g, fill) }, textStyle]}>{label}</Text>
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
  icon,
}: {
  label: string;
  onPress: () => void;
  fill?: BrutalFill;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  // the icon placed before the label on the senior (stacked) theme; not shown on other themes.
  icon?: string;
}) {
  const g = useGrammarColors();
  const variant = useButtonVariant();
  // zen: the text of the main (the a-filled, "Knew it") button underlined; retro95: the first
  // letter of the button underlined.
  const underlineAll = variant === 'text' && fill === 'a';
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
      boxStyle={styles.button}
    >
      <Text
        style={[
          styles.buttonText,
          { color: actionTextColor(g, fill, variant) },
          underlineAll ? styles.underline : null,
        ]}
      >
        {text}
      </Text>
    </BrutalBox>
  );
}

// input field on the brutalist palette: 2.5 px ink border, corner 0, paper background.
export function brutalInputStyle(g: GrammarColors): TextStyle {
  // the theme's own input-field colour (retro95: white "field"), if it has one; otherwise the paper.
  return { borderWidth: 2.5, borderColor: g.ink, borderRadius: 0, backgroundColor: g.extra.field ?? g.paper, color: g.ink };
}

// switch. On the brutalist palette a rectangular track (2.5 px ink border, corner 0), a square
// ink knob, when on the track has the `a` fill; on the classic palette today's Switch.
export function BrutalSwitch({
  value,
  onValueChange,
  disabled,
  testID,
}: {
  value: boolean;
  onValueChange?: (value: boolean) => void;
  disabled?: boolean;
  testID?: string;
}) {
  const g = useGrammarColors();
  const { theme } = useTheme();
  const { shape } = useSkin().skin;
  if (!g.brutal) {
    return <Switch testID={testID} value={value} onValueChange={onValueChange} disabled={disabled} trackColor={{ true: Colors[theme].tint }} />;
  }
  const round = smallRadius(shape, 14);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
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
    <BrutalBox testID={testID} onPress={onPress} offset={2} kind="button" boxStyle={styles.backBox}>
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
              backgroundColor: i < filled ? g.ink : 'transparent',
              ...smallRadius(shape, 4),
            },
          ]}
        />
      ))}
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
  segment: { flex: 1, height: 9, borderWidth: 2 },
});
