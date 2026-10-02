import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/KText';

import Colors from '@/constants/Colors';
import { speak } from '@/lib/speech';
import { t } from '@/lib/i18n';
import { charDiff } from '@/lib/charDiff';
import { speechLang } from '@/lib/languages';
import type { PcicItem, PcicTarget } from '@/data/pcic';
import { pcicAlternatives, type PcicGrade } from '@/lib/pcicMatch';
import { sm2PreviewDays, type Sm2Card, type Sm2Grade } from '@/lib/sm2';
import ResultBadge from '@/components/ResultBadge';
import { useGrammarColors } from '@/lib/grammarColors';
import { BrutalBox, actionTextColor, useButtonVariant } from '@/components/grammar/Brutal';
import { SkinSpeakLabel } from '@/components/skins/Slots';
import { legibleOn, textContrastMin } from '@/constants/Skins';
import { useDiffStyles } from '@/lib/useDiffStyles';
import { useSkin } from '@/lib/useSkin';

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
  const { skin } = useSkin();
  const diff = useDiffStyles();
  const variant = useButtonVariant();
  const stacked = variant === 'stacked';
  const previewDays = sm2PreviewDays(current, today);
  const previews = Object.fromEntries(
    GRADES.map((g) => [g, previewDays[g] === 0 ? s.pcic.intervalToday : s.pcic.intervalDays(previewDays[g])])
  ) as Record<Sm2Grade, string>;
  const example = target === 'es' ? currentItem?.exampleEs : currentItem?.exampleEn;
  const exampleGloss = target === 'es' ? currentItem?.exampleEn : currentItem?.exampleEs;

  // PLAN-learn-words-open 5a: ha a beírt válasz betűre és ékezetre pontosan a cél
  // (kis-nagybetűt és a széli szóközt nem számítva), a zöld visszhang kimarad, a
  // szó csak egyszer látszik (a rózsaszín sor a hangszóróval).
  const typedExact = typedAnswer.trim().toLowerCase() === grade.best.trim().toLowerCase();

  // PLAN-tobbjelentes 3. lépés (SZ8): ha a válasznak több alternatívája van (S1, pl. "el carro /
  // el coche"), a mutatott helyes alak alatt a többi is látszik, hogy a tanuló tudja, melyik még jó.
  const alsoAlternatives = pcicAlternatives(target === 'es' ? currentItem.es : currentItem.en).filter(
    (alt) => alt !== grade.best
  );

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
                  ? diff.missing
                  : d.wrong
                    ? diff.wrong
                    : { color: nextGrade === 'good' ? '#22C55E' : colors.text }
              }
            >
              {d.ch}
            </Text>
          ))}
        </Text>
        )}
        <View style={styles.frontRow}>
          <Text testID="pcic-correct-answer" variant="word" style={[styles.correctAnswer, { color: legibleOn(colors.tint, colors.card, textContrastMin(skin, 'word', 22, true)) }]}>{grade.best}</Text>
          <Pressable onPress={() => speak(grade.best, speechLang(target))} style={styles.speakBtn}>
            <Text style={styles.speakIcon}>🔊</Text>
            <SkinSpeakLabel />
          </Pressable>
        </View>
        {alsoAlternatives.length > 0 && (
          <Text testID="learn-also" style={[styles.alsoLine, { color: colors.tabIconDefault }]}>
            {s.pcic.alsoLabel}:{' '}
            {alsoAlternatives.map((alt, i) => (
              <Text key={alt}>
                {i > 0 ? ' · ' : ''}
                <Text style={styles.alsoAlt}>{alt}</Text>
              </Text>
            ))}
          </Text>
        )}
        {/* s2 (anki-ui-terv.html): ékezet-szigor KI + csak-ékezet eltérés
            -> a diff sárga jelölése mellett kimondva is 100%-nak számít. */}
        {grade.accentOnly && (
          <Text style={[styles.accentNote, { color: colors.tabIconDefault }]}>{s.pcic.accentForgiven}</Text>
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
                <SkinSpeakLabel />
              </Pressable>
            </View>
            <Text style={[styles.exampleEn, { color: colors.tabIconDefault }]}>{exampleGloss}</Text>
          </>
        )}
      </View>

      {/* Kálmán 2026-09-21: a régi (PR #27 előtti) Tudtam/Nem tudtam
          gombsor vissza, intervallum-előnézettel; a koppintás dönt és
          értékel, üres beküldés után is. */}
      <View testID="pcic-grades" style={[styles.gradesRow, g.brutal && styles.brutalGradesRow, g.brutal && stacked && styles.gradesStacked]}>
        {GRADES.map((gr) => {
          const isPre = nextGrade === gr;
          if (g.brutal) {
            // NY19: doboz (good = a, again = b). PLAN-learn-words-open 5a: a két gomb
            // egyforma (azonos árnyék-eltolás, a sor a kártya teljes szélességén).
            // PLAN-temak 6E: a téma gomb-változata: senior = egymás alatt + ikon, zen = csak szöveg,
            // a "Tudom" aláhúzva.
            const fill = gr === 'good' ? 'a' : 'b';
            const labelColor = actionTextColor(g, fill, variant);
            return (
              <BrutalBox
                key={gr}
                testID={`pcic-grade-${gr}`}
                fill={fill}
                offset={2}
                action
                style={stacked ? styles.brutalGradeStacked : styles.brutalGrade}
                boxStyle={stacked ? styles.brutalGradeBoxStacked : styles.brutalGradeBox}
                onPress={() => onGrade(gr)}
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
                <Text style={[styles.gradePreview, { color: labelColor }]}>{previews[gr]}</Text>
              </BrutalBox>
            );
          }
          return (
            <Pressable
              key={gr}
              style={({ pressed }) => [
                styles.gradeBtn,
                {
                  backgroundColor: legibleOn(pressed ? (gr === 'good' ? '#22C55E' : '#EF4444') : gr === 'good' ? '#38BDF8' : '#1D4ED8', '#FFFFFF'),
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
  // FB460: a "Not quite!" jelvény és a beírt (rontott) szó közt látható rés kell (régen 0 px volt, a két elem összeért).
  diffLine: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 1,
    marginTop: 12,
    marginBottom: 6,
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
  // PLAN-tobbjelentes 3. lépés: "also: b · c" sor a helyes alak alatt.
  alsoLine: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
  alsoAlt: {
    fontWeight: '700',
  },
  // s2 (anki-ui-terv.html): "Missing accent, counted as correct" sor.
  accentNote: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
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
  // PLAN-temak 6E (senior): a két gomb egymás alatt, teljes szélességben.
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
  gradePreview: {
    fontSize: 11,
    marginTop: 2,
    textAlign: 'center',
    color: '#FFFFFF',
  },
});
