import { StyleSheet, View } from 'react-native';

import CheckMark from '@/components/CheckMark';
import { BrutalBox } from '@/components/grammar/Brutal';
import { useGrammarColors } from '@/lib/grammarColors';

// FB402 (PLAN-fb0929 6. lépés), Kálmán: „done for today nál legyen egy új kép, ami most
// van nem megy a stílushoz". A 🎉 emoji helyett neo-brutalista jelvény, kép nélkül:
// vastag ink keretű, eltolt árnyékos négyzet a kitöltés színén, benne a rajzolt pipa,
// körülötte pár elforgatott konfetti-négyzet a két paletta-színben. Minden szín a
// tokenből jön (useGrammarColors), külső kép nincs.
const CONFETTI: { top: number; left: number; size: number; rotate: string; fill: 'a' | 'b' | 'ink' | 'paper' }[] = [
  { top: 6, left: 18, size: 16, rotate: '18deg', fill: 'b' },
  { top: 0, left: 150, size: 12, rotate: '-24deg', fill: 'ink' },
  { top: 44, left: 196, size: 18, rotate: '30deg', fill: 'a' },
  { top: 118, left: 6, size: 14, rotate: '-14deg', fill: 'a' },
  { top: 132, left: 186, size: 14, rotate: '12deg', fill: 'b' },
  { top: 98, left: 210, size: 10, rotate: '-30deg', fill: 'ink' },
];

export default function DoneBadge({ testID = 'done-badge' }: { testID?: string }) {
  const g = useGrammarColors();
  const fills = { a: g.a, b: g.b, ink: g.ink, paper: g.paper };
  return (
    <View testID={testID} style={styles.wrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {CONFETTI.map((c, i) => (
        <View
          key={i}
          style={[
            styles.confetti,
            { top: c.top, left: c.left, width: c.size, height: c.size, backgroundColor: fills[c.fill], borderColor: g.ink, transform: [{ rotate: c.rotate }] },
          ]}
        />
      ))}
      <View style={styles.center}>
        <BrutalBox fill="a" offset={6} boxStyle={styles.box}>
          <CheckMark size={72} color={g.ink} thickness={12} />
        </BrutalBox>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 240, height: 170, alignSelf: 'center' },
  center: { position: 'absolute', top: 18, left: 56 },
  box: { width: 112, height: 112, alignItems: 'center', justifyContent: 'center', borderWidth: 3 },
  confetti: { position: 'absolute', borderWidth: 2 },
});
