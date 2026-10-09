import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { SkinDecor } from '@/components/skins/types';
import { useGrammarColors } from '@/lib/grammarColors';
import { useSkin } from '@/lib/useSkin';

// Pop art: Ben-Day pöttyök (a szín, 40%) a háttérben egy 10 x 14-es, soronként
// eltolt rácson (140 pötty, a méretük fentről lefelé kisebb), és a kártya (szövegbuborék) bal alsó
// sarkán buborék-farok: egy ink háromszög, benne papír-színű, hogy a keret vonala vele folytatódjon.

const COLS = 10;
const ROWS = 14;
const TAIL = 26;
const TAIL_LEFT = 48;
const TAIL_INNER = 19;
const TAIL_EDGE = 3;

type Pct = `${number}%`;
type Dot = { left: Pct; top: Pct; size: number };

const DOTS: Dot[] = Array.from({ length: ROWS * COLS }, (_, i) => {
  const row = Math.floor(i / COLS);
  const col = i % COLS;
  return {
    left: `${(((col + 0.5 + (row % 2) * 0.5) / (COLS + 0.5)) * 100).toFixed(2)}%` as Pct,
    top: `${(((row + 0.5) / ROWS) * 100).toFixed(2)}%` as Pct,
    size: Math.round(11 - (6 * row) / (ROWS - 1)),
  };
});

function PopartBackdrop() {
  const g = useGrammarColors();
  return (
    <View testID="decor-popart-dots" pointerEvents="none" style={StyleSheet.absoluteFill}>
      {DOTS.map((d, i) => (
        <View
          key={i}
          testID="decor-popart-dot"
          style={{
            position: 'absolute',
            left: d.left,
            top: d.top,
            width: d.size,
            height: d.size,
            marginLeft: -d.size / 2,
            marginTop: -d.size / 2,
            borderRadius: d.size / 2,
            backgroundColor: g.a,
            opacity: 0.4,
          }}
        />
      ))}
    </View>
  );
}

function PopartCardFrame({ children }: { children: ReactNode }) {
  const g = useGrammarColors();
  const { shape } = useSkin().skin;
  const reach = TAIL - shape.borderWidth;
  return (
    <View testID="skin-popart-frame" style={{ marginBottom: reach }}>
      {children}
      <View testID="decor-popart-tail" pointerEvents="none" style={[styles.tail, { left: TAIL_LEFT, bottom: -reach }]}>
        <View
          testID="decor-popart-tail-edge"
          style={{ width: 0, height: 0, borderTopWidth: TAIL, borderRightWidth: TAIL, borderTopColor: g.ink, borderRightColor: 'transparent' }}
        />
        <View
          testID="decor-popart-tail-fill"
          style={{
            position: 'absolute',
            left: TAIL_EDGE,
            top: 0,
            width: 0,
            height: 0,
            borderTopWidth: TAIL_INNER,
            borderRightWidth: TAIL_INNER,
            borderTopColor: g.paper,
            borderRightColor: 'transparent',
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tail: { position: 'absolute', width: TAIL, height: TAIL },
});

export const popartDecor: SkinDecor = {
  Backdrop: PopartBackdrop,
  CardFrame: PopartCardFrame,
};
