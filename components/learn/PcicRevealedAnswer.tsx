import { Pressable, StyleSheet, Text, View } from 'react-native';

import Colors from '@/constants/Colors';
import { speak } from '@/lib/speech';
import { t } from '@/lib/i18n';
import { charDiff } from '@/lib/charDiff';
import { speechLang } from '@/lib/languages';
import type { PcicItem, PcicTarget } from '@/data/pcic';
import type { PcicGrade } from '@/lib/pcicMatch';
import { sm2PreviewDays, type Sm2Card, type Sm2Grade } from '@/lib/sm2';
import { sensesFor } from '@/lib/pcicSenses';
import ResultBadge from '@/components/ResultBadge';
import { useGrammarColors } from '@/lib/grammarColors';
import { BrutalBox } from '@/components/grammar/Brutal';

// PLAN-play 14. lépés: a PCIC kártya felfedett-állapot blokkja
// (app/(tabs)/index.tsx-ből kiemelve, felelősség szerinti szétvágás, nincs
// viselkedés-változás): a Check utáni diff + helyes alak + példamondat, és a
// Tudtam/Nem tudtam gombsor. A hívó csak `grade` truthy esetén rendereli.

// A régi (PR #27 előtti) gombsor sorrendje: Nem tudtam, Tudtam.
const GRADES: Sm2Grade[] = ['again', 'good'];

export default function PcicRevealedAnswer({
  colors,
  s,
  typedAnswer,
  grade,
  nextGrade,
  current,
  currentItem,
  today,
  target,
  onGrade,
}: {
  colors: (typeof Colors)['light'];
  s: ReturnType<typeof t>;
  typedAnswer: string;
  grade: PcicGrade;
  nextGrade: Sm2Grade | null;
  current: Sm2Card;
  currentItem: PcicItem;
  today: string;
  // PLAN-ketiranyu 4. lépés: melyik irány aktív, hogy a felfedés (felolvasás,
  // példamondat, jelentés-lista) a célnyelvet mutassa, ne mindig a spanyolt.
  target: PcicTarget;
  onGrade: (g: Sm2Grade) => void;
}) {
  // A régi gombsor intervallum-előnézete grade-enként (lib/sm2.ts
  // sm2PreviewDays), i18n-nel formázva (FB350/5. commit: ne csak magyarul).
  const g = useGrammarColors();
  const previewDays = sm2PreviewDays(current, today);
  const previews = Object.fromEntries(
    GRADES.map((g) => [g, previewDays[g] === 0 ? s.pcic.intervalToday : s.pcic.intervalDays(previewDays[g])])
  ) as Record<Sm2Grade, string>;
  // PLAN-fb0924 7b. lépés (FB384, D4): ha ennek a szónak több, érdemben eltérő
  // jelentése van (data/pcic/senses.json), a felfedés jelentésenként mutatja a
  // spanyol alakot (a beírandó válasz továbbra is a szó maga, currentItem.es).
  // PLAN-ketiranyu 4. lépés: a jelentés-lista angol glossz, csak es célnyelven van értelme.
  const senses = target === 'es' ? sensesFor(currentItem.id) : undefined;
  const example = target === 'es' ? currentItem?.exampleEs : currentItem?.exampleEn;
  const exampleGloss = target === 'es' ? currentItem?.exampleEn : currentItem?.exampleEs;

  // PLAN-learn-words-open 5a: ha a beírt válasz betűre és ékezetre pontosan a cél
  // (kis-nagybetűt és a széli szóközt nem számítva), a zöld visszhang kimarad, a
  // szó csak egyszer látszik (a rózsaszín sor a hangszóróval).
  const typedExact = typedAnswer.trim().toLowerCase() === grade.best.trim().toLowerCase();

  return (
    <>
      <View style={styles.resultSection}>
        {/* FB403: egyetlen, minden kártyán azonos jó / rossz jelzés (szín + alak + ✓/✗ + szöveg). */}
        <ResultBadge correct={nextGrade === 'good'} align="center" testID="pcic-result-badge" />
        {!typedExact && (
        <Text testID="pcic-diff-line" style={styles.diffLine}>
          {charDiff(typedAnswer, grade.best, { case: true, accents: false }).map((d, i) => (
            <Text
              key={i}
              style={
                d.missing
                  ? styles.diffMissing
                  : d.wrong
                    ? styles.diffWrong
                    : { color: nextGrade === 'good' ? '#22C55E' : colors.text }
              }
            >
              {d.ch}
            </Text>
          ))}
        </Text>
        )}
        <View style={styles.frontRow}>
          <Text style={[styles.correctAnswer, { color: colors.tint }]}>{grade.best}</Text>
          <Pressable onPress={() => speak(grade.best, speechLang(target))} style={styles.speakBtn}>
            <Text style={styles.speakIcon}>🔊</Text>
          </Pressable>
        </View>
        {/* s2 (anki-ui-terv.html): ékezet-szigor KI + csak-ékezet eltérés
            -> a diff sárga jelölése mellett kimondva is 100%-nak számít. */}
        {grade.accentOnly && (
          <Text style={[styles.accentNote, { color: colors.tabIconDefault }]}>{s.pcic.accentForgiven}</Text>
        )}
        {/* PLAN-fb0924 7b. lépés (FB384, D4): jelentésenként a rövid spanyol
            alak, ha a szónak több, érdemben eltérő jelentése van. */}
        {senses && senses.length > 1 && (
          <View style={styles.sensesBlock}>
            {senses.map((sense, i) => (
              <View key={i} style={styles.senseRow}>
                <Text style={[styles.senseEn, { color: colors.tabIconDefault }]}>{sense.en}</Text>
                <Text style={[styles.senseEs, { color: colors.text }]}>{sense.es}</Text>
              </View>
            ))}
          </View>
        )}
        {/* PLAN-play 11. lépés: példamondat a megoldás alatt, csak Check
            után és csak ha van egyezés a korpuszban (currentItem.exampleEs).
            PLAN-ketiranyu 4. lépés: célnyelven szól, a másik nyelv a gloss. */}
        {example && (
          <>
            <View style={[styles.frontRow, styles.exampleRow]}>
              <Text style={[styles.exampleEs, { color: colors.text }]}>{example}</Text>
              <Pressable onPress={() => speak(example, speechLang(target))} style={styles.speakBtn}>
                <Text style={styles.speakIcon}>🔊</Text>
              </Pressable>
            </View>
            <Text style={[styles.exampleEn, { color: colors.tabIconDefault }]}>{exampleGloss}</Text>
          </>
        )}
      </View>

      {/* Kálmán 2026-09-21: a régi (PR #27 előtti) Tudtam/Nem tudtam
          gombsor vissza, intervallum-előnézettel; a koppintás dönt és
          értékel, üres beküldés után is. */}
      <View style={[styles.gradesRow, g.brutal && styles.brutalGradesRow]}>
        {GRADES.map((gr) => {
          const isPre = nextGrade === gr;
          if (g.brutal) {
            // NY19: doboz (good = a, again = b). PLAN-learn-words-open 5a: a két gomb
            // egyforma (azonos árnyék-eltolás, a sor a kártya teljes szélességén).
            return (
              <BrutalBox
                key={gr}
                testID={`pcic-grade-${gr}`}
                fill={gr === 'good' ? 'a' : 'b'}
                offset={2}
                style={styles.brutalGrade}
                boxStyle={styles.brutalGradeBox}
                onPress={() => onGrade(gr)}
              >
                <Text style={[styles.gradeLabel, { color: g.onFill, fontWeight: '500', textTransform: 'uppercase' }]}>{s.pcic[gr]}</Text>
                <Text style={[styles.gradePreview, { color: g.onFill }]}>{previews[gr]}</Text>
              </BrutalBox>
            );
          }
          return (
            <Pressable
              key={gr}
              style={({ pressed }) => [
                styles.gradeBtn,
                {
                  backgroundColor: pressed ? (gr === 'good' ? '#22C55E' : '#EF4444') : gr === 'good' ? '#38BDF8' : '#1D4ED8',
                  borderColor: pressed ? (gr === 'good' ? '#22C55E' : '#EF4444') : isPre ? colors.text : 'transparent',
                  borderWidth: isPre ? 3 : 1,
                },
              ]}
              onPress={() => onGrade(gr)}
            >
              <Text style={styles.gradeLabel}>{s.pcic[gr]}</Text>
              <Text style={styles.gradePreview}>{previews[gr]}</Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  resultSection: {
    alignItems: 'center',
    marginTop: 16,
  },
  diffLine: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 6,
  },
  diffWrong: {
    backgroundColor: '#EF4444',
    color: '#FFFFFF',
  },
  diffMissing: {
    backgroundColor: '#EAB308',
    color: '#FFFFFF',
    textDecorationLine: 'underline',
  },
  correctAnswer: {
    flex: 1,
    flexShrink: 1,
    fontSize: 22,
    fontWeight: '600',
  },
  frontRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
  },
  // s2 (anki-ui-terv.html): "Missing accent, counted as correct" sor.
  accentNote: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  // PLAN-fb0924 7b. lépés (FB384, D4): jelentésenként egy sor (angol jelentés
  // fölül, halványan, a rövid spanyol alak alatta).
  sensesBlock: {
    marginTop: 12,
    gap: 6,
  },
  senseRow: {
    alignItems: 'center',
  },
  senseEn: {
    fontSize: 12,
  },
  senseEs: {
    fontSize: 15,
    fontWeight: '600',
  },
  // PLAN-play 11. lépés: példamondat a megoldás alatt, Check után.
  exampleRow: {
    marginTop: 12,
  },
  exampleEs: {
    flex: 1,
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  exampleEn: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
  speakBtn: {
    padding: 4,
    flexShrink: 0,
  },
  speakIcon: {
    fontSize: 22,
  },
  gradesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 24,
  },
  brutalGradesRow: { alignSelf: 'stretch' },
  brutalGrade: { flex: 1 },
  brutalGradeBox: { flex: 1, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
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
  gradePreview: {
    fontSize: 11,
    marginTop: 2,
    textAlign: 'center',
    color: '#FFFFFF',
  },
});
