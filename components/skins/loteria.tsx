import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/KText';

import type { SkinDecor } from '@/components/skins/types';
import { useGrammarColors } from '@/lib/grammarColors';
import { useSkin } from '@/lib/useSkin';

// Lotería: papel picado zászló-sor a fejlécben (a spec 5 színe), a kártya egy
// lotería-lap: piros sorszám bal fent, a szó alul egy vonal fölött. A lap sorszáma a szóból számolt
// (1-54, mint a lotería-paklin), a CardFrame és a WordRenderer egy kontextuson át osztozik rajta.

// A spec fix színei (a téma extra.flag1-5-je ugyanez); Saját mixben, más színekkel is ezek.
export const PAPEL_PICADO = ['#E4007C', '#FF8200', '#00A651', '#0072CE', '#FFD100'];

const FLAG_COUNT = 10;
const FLAG_W = 24;
const FLAG_H = 14;
const TOOTH_H = 6;
const BADGE = 26;
const BADGE_INSET = 4;

// A lap sorszáma: a szó betűiből képzett, 1 és 54 közötti szám (ugyanaz a szó, ugyanaz a szám).
export function loteriaNumber(word: string): number {
  let h = 0;
  for (const ch of word) h = (h * 31 + ch.charCodeAt(0)) % 54;
  return h + 1;
}

const NumberContext = createContext<(n: number) => void>(() => {});

function Flag({ color }: { color: string }) {
  return (
    <View>
      <View style={{ width: FLAG_W, height: FLAG_H, backgroundColor: color }} />
      <View style={styles.teeth}>
        <View style={[styles.tooth, { borderTopColor: color }]} />
        <View style={[styles.tooth, { borderTopColor: color }]} />
      </View>
    </View>
  );
}

function LoteriaHeader({ children }: { children: ReactNode }) {
  const g = useGrammarColors();
  return (
    <View>
      <View testID="decor-loteria-flags" pointerEvents="none" style={styles.flags}>
        <View style={{ height: 1, backgroundColor: g.ink }} />
        <View style={styles.flagRow}>
          {Array.from({ length: FLAG_COUNT }, (_, i) => (
            <Flag key={i} color={g.extra[`flag${(i % 5) + 1}`] ?? PAPEL_PICADO[i % 5]} />
          ))}
        </View>
      </View>
      {children}
    </View>
  );
}

function LoteriaCardFrame({ children }: { children: ReactNode }) {
  const g = useGrammarColors();
  const { shape } = useSkin().skin;
  const [number, setNumber] = useState(1);
  return (
    <NumberContext.Provider value={setNumber}>
      <View testID="skin-loteria-frame">
        {children}
        <View
          testID="decor-loteria-number"
          pointerEvents="none"
          style={[styles.badge, { top: shape.borderWidth + BADGE_INSET, left: shape.borderWidth + BADGE_INSET, backgroundColor: g.a }]}
        >
          <Text style={[styles.badgeText, { color: g.onA }]}>{number}</Text>
        </View>
      </View>
    </NumberContext.Provider>
  );
}

function LoteriaWord({ word, children }: { word: string; children: ReactNode }) {
  const g = useGrammarColors();
  const setNumber = useContext(NumberContext);
  useEffect(() => {
    setNumber(loteriaNumber(word));
  }, [word, setNumber]);
  return (
    <View style={styles.word}>
      {children}
      <View testID="decor-loteria-line" pointerEvents="none" style={[styles.line, { backgroundColor: g.ink }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  flags: { marginBottom: 8 },
  flagRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  teeth: { flexDirection: 'row' },
  tooth: {
    width: 0,
    height: 0,
    borderLeftWidth: FLAG_W / 4,
    borderRightWidth: FLAG_W / 4,
    borderTopWidth: TOOTH_H,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  badge: { position: 'absolute', minWidth: BADGE, height: BADGE, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 14, fontWeight: '700' },
  // flexShrink: a FitText a sor-konténerben összemegy, ezért a burkolója is.
  word: { flexShrink: 1, alignItems: 'center', gap: 6 },
  line: { height: 3, alignSelf: 'stretch' },
});

export const loteriaDecor: SkinDecor = {
  CardFrame: LoteriaCardFrame,
  WordRenderer: LoteriaWord,
  HeaderOrnament: LoteriaHeader,
};
