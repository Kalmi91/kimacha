import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/KText';

import type { SkinDecor } from '@/components/skins/types';

// Csillámpóni (glitter pony): a rainbow arc (6 bands) above the word, glitter dots and stars in the
// background, a horse icon in the header. The rainbow colours are the spec's fixed colours (not the theme's a / b / c),
// so in My mix, with other colours too, it stays a rainbow.

export const RAINBOW = ['#FF6EC7', '#FFB347', '#FFE066', '#7BE0AD', '#7FB8FF', '#C9A7FF'];

type Pct = `${number}%`;
type Sparkle = { left: Pct; top: Pct; size: number; color: string; star: boolean };

const SPARKLES: Sparkle[] = [
  { left: '8%', top: '10%', size: 6, color: RAINBOW[1], star: false },
  { left: '88%', top: '8%', size: 14, color: RAINBOW[0], star: true },
  { left: '18%', top: '34%', size: 5, color: RAINBOW[4], star: false },
  { left: '92%', top: '42%', size: 6, color: RAINBOW[3], star: false },
  { left: '6%', top: '58%', size: 12, color: RAINBOW[5], star: true },
  { left: '84%', top: '66%', size: 5, color: RAINBOW[2], star: false },
  { left: '14%', top: '82%', size: 6, color: RAINBOW[0], star: false },
  { left: '90%', top: '90%', size: 12, color: RAINBOW[1], star: true },
];

function CsillamponyBackdrop() {
  return (
    <View testID="decor-csillampony-sparkles" pointerEvents="none" style={StyleSheet.absoluteFill}>
      {SPARKLES.map((p, i) =>
        p.star ? (
          <Text key={i} style={{ position: 'absolute', left: p.left, top: p.top, fontSize: p.size, color: p.color }}>
            ✦
          </Text>
        ) : (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: p.left,
              top: p.top,
              width: p.size,
              height: p.size,
              borderRadius: p.size / 2,
              backgroundColor: p.color,
            }}
          />
        ),
      )}
    </View>
  );
}

// The rainbow arc: 6 nested half-circle rings, the outer one the largest, the half-ring is 4 px thick.
function Rainbow() {
  const outer = 40;
  const band = 4;
  return (
    <View testID="decor-csillampony-rainbow" pointerEvents="none" style={{ width: outer * 2, height: outer }}>
      {RAINBOW.map((color, i) => {
        const r = outer - i * band;
        return (
          <View
            key={color}
            testID="decor-csillampony-band"
            style={{
              position: 'absolute',
              bottom: 0,
              left: i * band,
              width: r * 2,
              height: r,
              borderTopLeftRadius: r,
              borderTopRightRadius: r,
              borderTopWidth: band,
              borderLeftWidth: band,
              borderRightWidth: band,
              borderColor: color,
            }}
          />
        );
      })}
    </View>
  );
}

function CsillamponyWord({ children }: { word: string; children: ReactNode }) {
  return (
    <View style={styles.word}>
      <View style={styles.arcRow}>
        <Text testID="decor-csillampony-star" style={[styles.star, { color: RAINBOW[1] }]}>✦</Text>
        <Rainbow />
        <Text testID="decor-csillampony-star" style={[styles.star, { color: RAINBOW[5] }]}>✦</Text>
      </View>
      {children}
    </View>
  );
}

function CsillamponyHeader({ children }: { children: ReactNode }) {
  return (
    <View>
      <View testID="decor-csillampony-pony" style={styles.pony}>
        <Text style={[styles.star, { color: RAINBOW[0] }]}>✦</Text>
        <Text style={styles.ponyIcon}>🐴</Text>
        <Text style={[styles.star, { color: RAINBOW[4] }]}>✦</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // flexShrink: the FitText shrinks inside the row container, so its wrapper must too.
  word: { flexShrink: 1, alignItems: 'center', gap: 4 },
  arcRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 8 },
  star: { fontSize: 14 },
  pony: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4 },
  ponyIcon: { fontSize: 22 },
});

export const csillamponyDecor: SkinDecor = {
  Backdrop: CsillamponyBackdrop,
  WordRenderer: CsillamponyWord,
  HeaderOrnament: CsillamponyHeader,
};
