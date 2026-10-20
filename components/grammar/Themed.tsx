import { Pressable, View, type StyleProp, type TextStyle, type ViewProps, type ViewStyle } from 'react-native';
import { Text, type KTextProps } from '@/components/KText';

import { BrutalBackButton, BrutalButton, SegmentBar, brutalInputStyle, segmentsFilled, type BrutalFill } from '@/components/grammar/Brutal';
import { useGrammarColors, type GrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';

// The themed primitives: they choose between the brutalist and the classic look themselves, so a
// screen renders once and never asks `g.brutal`. Where the two looks are different elements (a back
// box vs a plain arrow) the primitive owns that fork, once, instead of every screen repeating it.

const TITLE_BRUTAL: TextStyle = { textTransform: 'uppercase', fontWeight: '500' };

// A title / heading: uppercase, weight 500 on the brutalist palette, the caller's style otherwise.
export function TitleText({ style, ...rest }: KTextProps) {
  const g = useGrammarColors();
  return <Text {...rest} style={[style, g.brutal && TITLE_BRUTAL]} />;
}

// The input field style: the brutalist field (ink border, corner 0, paper), nothing on the classic palette.
export function themedInputStyle(g: GrammarColors): TextStyle | null {
  return g.brutal ? brutalInputStyle(g) : null;
}

const EDGE_BRUTAL: ViewStyle = { borderRadius: 0, borderWidth: 2 };

// The square 2 px edge of the small chips / option cards on the brutalist palette, nothing on classic.
export function themedEdgeStyle(g: GrammarColors): ViewStyle | null {
  return g.brutal ? EDGE_BRUTAL : null;
}

// The bottom sheet card: square top corners, a 2.5 px ink top edge on the brutalist palette.
export function themedSheetStyle(g: GrammarColors): ViewStyle | null {
  return g.brutal ? { borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTopWidth: 2.5, borderColor: g.ink } : null;
}

// The square 2 px ink edge (small boxes, table cells, tabs, POS chip) on the brutalist palette, nothing on classic.
export function themedInkEdgeStyle(g: GrammarColors): ViewStyle | null {
  return g.brutal ? { borderRadius: 0, borderWidth: 2, borderColor: g.ink } : null;
}

const DOCK_PAD_BRUTAL: ViewStyle = { paddingBottom: 130 };

// The scroll content's bottom padding that clears the docked action button on the brutalist palette.
export function themedDockPad(g: GrammarColors): ViewStyle | null {
  return g.brutal ? DOCK_PAD_BRUTAL : null;
}

// The accent text colour (links, titles): ink on the brutalist palette, the classic accent otherwise.
export function accentColor(g: GrammarColors, classic: string): string {
  return g.brutal ? g.ink : classic;
}

// The back arrow of an in-screen header row: a small BrutalBox on the brutalist palette, the plain
// arrow text on classic. `wrapStyle`: a layout View around the brutalist box (none if omitted);
// `pressStyle`: the classic Pressable's style; `arrowStyle`: the classic arrow text (size, colour).
// The testID goes on the brutalist box only (classic has none).
export function BackButton({
  onPress,
  testID,
  wrapStyle,
  pressStyle,
  arrowStyle,
}: {
  onPress: () => void;
  testID?: string;
  wrapStyle?: StyleProp<ViewStyle>;
  pressStyle?: StyleProp<ViewStyle>;
  arrowStyle?: StyleProp<TextStyle>;
}) {
  const g = useGrammarColors();
  if (g.brutal) {
    const box = <BrutalBackButton testID={testID} onPress={onPress} />;
    return wrapStyle ? <View style={wrapStyle}>{box}</View> : box;
  }
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t().a11y.back} onPress={onPress} hitSlop={12} style={pressStyle}>
      <Text style={arrowStyle}>←</Text>
    </Pressable>
  );
}

// The main push button: a BrutalButton on the brutalist palette, a plain Pressable with the caller's
// classic look otherwise. `testID` goes on both, `brutalTestID` on the brutalist button only;
// `classicRole` null = the classic Pressable has no accessibilityRole (as before).
export function ActionButton({
  label,
  onPress,
  fill,
  testID,
  brutalTestID,
  brutalStyle,
  classicStyle,
  classicTextStyle,
  classicRole = 'button',
}: {
  label: string;
  onPress: () => void;
  fill?: BrutalFill;
  testID?: string;
  brutalTestID?: string;
  brutalStyle?: StyleProp<ViewStyle>;
  classicStyle?: StyleProp<ViewStyle>;
  classicTextStyle?: StyleProp<TextStyle>;
  classicRole?: 'button' | null;
}) {
  const g = useGrammarColors();
  if (g.brutal) return <BrutalButton testID={testID ?? brutalTestID} label={label} onPress={onPress} fill={fill} style={brutalStyle} />;
  return (
    <Pressable testID={testID} accessibilityRole={classicRole ?? undefined} style={classicStyle} onPress={onPress}>
      <Text style={classicTextStyle}>{label}</Text>
    </Pressable>
  );
}

// A progress bar: the segmented bar on the brutalist palette (`filled` of `segments` blocks, by default
// from `pct`), a track + fill on classic. `testID` goes on the segmented bar; `trackProps` / `fillProps`
// carry the classic track's / fill's own testID and accessibility props; `fillWidth` overrides the
// fill's width in percent (default `pct`).
export function ProgressBar({
  pct,
  filled,
  segments = 8,
  testID,
  brutalStyle,
  trackStyle,
  trackColor,
  fillStyle,
  fillColor,
  fillWidth,
  trackProps,
  fillProps,
}: {
  pct: number;
  filled?: number;
  segments?: number;
  testID?: string;
  brutalStyle?: StyleProp<ViewStyle>;
  trackStyle?: StyleProp<ViewStyle>;
  trackColor: string;
  fillStyle?: StyleProp<ViewStyle>;
  fillColor: string;
  fillWidth?: number;
  trackProps?: ViewProps;
  fillProps?: ViewProps;
}) {
  const g = useGrammarColors();
  if (g.brutal) return <SegmentBar testID={testID} filled={filled ?? segmentsFilled(pct, segments)} segments={segments} style={brutalStyle} />;
  return (
    <View {...trackProps} style={[trackStyle, { backgroundColor: trackColor }]}>
      <View {...fillProps} style={[fillStyle, { backgroundColor: fillColor, width: `${fillWidth ?? pct}%` }]} />
    </View>
  );
}
