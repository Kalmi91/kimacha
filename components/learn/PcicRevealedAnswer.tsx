import { Pressable, StyleSheet, Text, View } from 'react-native';

import Colors from '@/constants/Colors';
import { speak } from '@/lib/speech';
import { t } from '@/lib/i18n';
import { charDiff } from '@/lib/charDiff';
import { speechLang } from '@/lib/languages';
import type { PcicItem } from '@/data/pcic';
import type { PcicGrade } from '@/lib/pcicMatch';
import { sm2PreviewDays, type Sm2Card, type Sm2Grade } from '@/lib/sm2';

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
  onGrade: (g: Sm2Grade) => void;
}) {
  // A régi gombsor intervallum-előnézete grade-enként (lib/sm2.ts
  // sm2PreviewDays), i18n-nel formázva (FB350/5. commit: ne csak magyarul).
  const previewDays = sm2PreviewDays(current, today);
  const previews = Object.fromEntries(
    GRADES.map((g) => [g, previewDays[g] === 0 ? s.pcic.intervalToday : s.pcic.intervalDays(previewDays[g])])
  ) as Record<Sm2Grade, string>;

  return (
    <>
      <View style={styles.resultSection}>
        <Text style={styles.diffLine}>
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
        <View style={styles.frontRow}>
          <Text style={[styles.correctAnswer, { color: colors.tint }]}>{grade.best}</Text>
          <Pressable onPress={() => speak(grade.best, speechLang('es'))} style={styles.speakBtn}>
            <Text style={styles.speakIcon}>🔊</Text>
          </Pressable>
        </View>
        {/* s2 (anki-ui-terv.html): ékezet-szigor KI + csak-ékezet eltérés
            -> a diff sárga jelölése mellett kimondva is 100%-nak számít. */}
        {grade.accentOnly && (
          <Text style={[styles.accentNote, { color: colors.tabIconDefault }]}>{s.pcic.accentForgiven}</Text>
        )}
        {/* PLAN-play 11. lépés: példamondat a megoldás alatt, csak Check
            után és csak ha van egyezés a korpuszban (currentItem.exampleEs). */}
        {currentItem?.exampleEs && (
          <>
            <View style={[styles.frontRow, styles.exampleRow]}>
              <Text style={[styles.exampleEs, { color: colors.text }]}>{currentItem.exampleEs}</Text>
              <Pressable onPress={() => speak(currentItem.exampleEs!, speechLang('es'))} style={styles.speakBtn}>
                <Text style={styles.speakIcon}>🔊</Text>
              </Pressable>
            </View>
            <Text style={[styles.exampleEn, { color: colors.tabIconDefault }]}>{currentItem.exampleEn}</Text>
          </>
        )}
      </View>

      {/* Kálmán 2026-09-21: a régi (PR #27 előtti) Tudtam/Nem tudtam
          gombsor vissza, intervallum-előnézettel; a koppintás dönt és
          értékel, üres beküldés után is. */}
      <View style={styles.gradesRow}>
        {GRADES.map((g) => {
          const isPre = nextGrade === g;
          return (
            <Pressable
              key={g}
              style={({ pressed }) => [
                styles.gradeBtn,
                {
                  backgroundColor: pressed ? (g === 'good' ? '#22C55E' : '#EF4444') : g === 'good' ? '#38BDF8' : '#1D4ED8',
                  borderColor: pressed ? (g === 'good' ? '#22C55E' : '#EF4444') : isPre ? colors.text : 'transparent',
                  borderWidth: isPre ? 3 : 1,
                },
              ]}
              onPress={() => onGrade(g)}
            >
              <Text style={styles.gradeLabel}>{s.pcic[g]}</Text>
              <Text style={styles.gradePreview}>{previews[g]}</Text>
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
    color: '#FFFFFF',
  },
  gradePreview: {
    fontSize: 11,
    marginTop: 2,
    color: '#FFFFFF',
  },
});
