import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { BASE } from '@/constants/GrammarPalettes';
import { useGrammarColors, type GrammarColors } from '@/lib/grammarColors';

// NY20: a neo-brutalista forma-elemek (NYELVTAN.md "Neo-brutalista stílus").
// Csak akkor használjuk őket, ha useGrammarColors().brutal igaz; a classic
// paletta a mai kinézetet adja, ezek nélkül.

export type BrutalFill = 'paper' | 'a' | 'b' | 'ink';

function fillColor(g: GrammarColors, fill: BrutalFill): string {
  if (fill === 'a') return g.a;
  if (fill === 'b') return g.b;
  if (fill === 'ink') return g.ink;
  return g.paper;
}

// A szöveg színe az adott kitöltésen: színes (a / b) kitöltésen mindig onFill,
// tintán a papír-alap, papíron az ink.
export function textOnFill(g: GrammarColors, fill: BrutalFill): string {
  if (fill === 'a' || fill === 'b') return g.onFill;
  if (fill === 'ink') return g.bg;
  return g.ink;
}

// A fő gomb (ink kitöltés) szövege: világos módban a b szín, sötét módban (ahol az ink
// világos) a sötét alap, hogy olvasható maradjon.
export function inkButtonText(g: GrammarColors): string {
  return g.bg === BASE.dark.bg ? g.bg : g.b;
}

// Doboz: 2,5 px ink keret, sarok 0, tömör eltolt árnyék (3 px jobbra + 3 px le,
// ink színnel, elmosás nélkül). RN-ben nem elevation/shadow*: egy ink színű
// hátsó View, a doboz mögé eltolva. Zárt (dashed) doboz: szaggatott keret,
// árnyék nélkül.
export function BrutalBox({
  children,
  fill = 'paper',
  dashed = false,
  offset = 3,
  style,
  boxStyle,
  onPress,
  disabled,
  testID,
  accessibilityLabel,
}: {
  children?: ReactNode;
  fill?: BrutalFill;
  dashed?: boolean;
  offset?: number;
  // A külső (elrendezési) burkoló stílusa.
  style?: StyleProp<ViewStyle>;
  // Az előlapi doboz stílusa (padding, igazítás).
  boxStyle?: StyleProp<ViewStyle>;
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const g = useGrammarColors();
  const front: StyleProp<ViewStyle> = [
    {
      backgroundColor: fillColor(g, fill),
      borderWidth: 2.5,
      borderColor: g.ink,
      borderStyle: dashed ? 'dashed' : 'solid',
    },
    boxStyle,
  ];
  return (
    <View style={[{ marginRight: offset, marginBottom: offset }, style]}>
      {dashed ? null : (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: offset, top: offset, right: -offset, bottom: -offset, backgroundColor: g.ink }}
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

// Matrica: 2 px keret, kis betű, 500 súly, -6° és +8° közti elforgatás
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
  return (
    <View
      testID={testID}
      style={[
        styles.sticker,
        { backgroundColor: fillColor(g, fill), borderColor: g.ink, transform: [{ rotate: `${rotate}deg` }] },
        style,
      ]}
    >
      <Text style={[styles.stickerText, { color: textOnFill(g, fill) }, textStyle]}>{label}</Text>
    </View>
  );
}

// Lecke-kártya: brutalista palettán BrutalBox (paper vagy b kitöltéssel), classic
// paletta esetén a mai sima kártya (classicStyle + a paper = mai card szín).
export function Card({
  children,
  fill = 'paper',
  style,
  classicStyle,
}: {
  children?: ReactNode;
  fill?: BrutalFill;
  style?: StyleProp<ViewStyle>;
  classicStyle?: StyleProp<ViewStyle>;
}) {
  const g = useGrammarColors();
  if (g.brutal) {
    return (
      <BrutalBox fill={fill} style={style} boxStyle={styles.card}>
        {children}
      </BrutalBox>
    );
  }
  return <View style={[{ backgroundColor: g.paper }, classicStyle, style]}>{children}</View>;
}

// Hány blokk legyen kitöltve a szegmentált sávban egy 0-100 százalékhoz.
export function segmentsFilled(percent: number, segments: number): number {
  return Math.max(0, Math.min(segments, Math.round((percent / 100) * segments)));
}

// Szegmentált progress: 5-8 blokk, 9 px magas, 2 px keret, kész blokk = ink kitöltés.
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
  return (
    <View testID={testID} style={[styles.segmentRow, style]}>
      {Array.from({ length: segments }, (_, i) => (
        <View
          key={i}
          testID={testID ? `${testID}-${i}` : undefined}
          style={[
            styles.segment,
            { borderColor: g.ink, backgroundColor: i < filled ? g.ink : 'transparent' },
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
  segmentRow: { flexDirection: 'row', gap: 3 },
  segment: { flex: 1, height: 9, borderWidth: 2 },
});
