import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/KText';

import Colors from '@/constants/Colors';
import { t } from '@/lib/i18n';
import { useGrammarColors } from '@/lib/grammarColors';
import { BrutalBox, actionTextColor, useButtonVariant } from '@/components/grammar/Brutal';
import { legibleOn } from '@/constants/Skins';

// a szókártya Check utáni "Didn't know" / "Knew it" felülbíráló gombsora
// (PcicRevealedAnswer.tsx) a mondatkártyákon is, ugyanazzal a megjelenéssel. A mondatkártya
// nem ír SRS-t (K3), ezért itt nincs intervallum-előnézet: a koppintás a kijelzett
// értékelést (jelvény, keret, Next szín) írja át, a Next utána ezt adja tovább.
const GRADES = ['again', 'good'] as const;

export default function SentenceGradeRow({
  colors,
  result,
  onOverride,
}: {
  colors: (typeof Colors)['light'];
  // A most kijelzett értékelés: az előre kijelölt gomb ez.
  result: 'correct' | 'wrong';
  onOverride: (correct: boolean) => void;
}) {
  const s = t();
  const g = useGrammarColors();
  const variant = useButtonVariant();
  const stacked = variant === 'stacked';

  return (
    <View testID="sentence-grades" style={[styles.gradesRow, g.brutal && stacked && styles.gradesStacked]}>
      {GRADES.map((gr) => {
        const isPre = (result === 'correct') === (gr === 'good');
        if (g.brutal) {
          const fill = gr === 'good' ? 'a' : 'b';
          const labelColor = actionTextColor(g, fill, variant);
          return (
            <BrutalBox
              key={gr}
              testID={`sentence-grade-${gr}`}
              fill={fill}
              offset={2}
              action
              style={stacked ? styles.brutalGradeStacked : styles.brutalGrade}
              boxStyle={stacked ? styles.brutalGradeBoxStacked : styles.brutalGradeBox}
              onPress={() => onOverride(gr === 'good')}
            >
              <Text
                style={[
                  styles.gradeLabel,
                  { color: labelColor, fontWeight: '500', textTransform: 'uppercase' },
                  variant === 'text' && gr === 'good' && styles.gradeUnderline,
                ]}
              >
                {stacked ? `${gr === 'good' ? '✓' : '✗'}  ${s.pcic[gr]}` : s.pcic[gr]}
              </Text>
            </BrutalBox>
          );
        }
        return (
          <Pressable
            key={gr}
            testID={`sentence-grade-${gr}`}
            style={({ pressed }) => [
              styles.gradeBtn,
              {
                backgroundColor: legibleOn(pressed ? (gr === 'good' ? '#22C55E' : '#EF4444') : gr === 'good' ? '#38BDF8' : '#1D4ED8', '#FFFFFF'),
                borderColor: pressed ? (gr === 'good' ? '#22C55E' : '#EF4444') : isPre ? colors.text : 'transparent',
                borderWidth: isPre ? 3 : 1,
              },
            ]}
            onPress={() => onOverride(gr === 'good')}
          >
            <Text style={styles.gradeLabel}>{s.pcic[gr]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  gradesRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: 8,
  },
  brutalGrade: { flex: 1 },
  brutalGradeBox: { flex: 1, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
  gradesStacked: { flexDirection: 'column' },
  brutalGradeStacked: { alignSelf: 'stretch' },
  brutalGradeBoxStacked: { paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  gradeUnderline: { textDecorationLine: 'underline' },
  gradeBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeLabel: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    color: '#FFFFFF',
  },
});
