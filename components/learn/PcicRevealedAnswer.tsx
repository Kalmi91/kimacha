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

// the revealed-state block of the PCIC card
// (extracted from app/(tabs)/index.tsx, split by responsibility, no
// behaviour change): the post-Check diff + correct form + example sentence, and the
// Didn't know / Knew it button row. The caller only renders it when `grade` is truthy.

// The old (pre-PR #27) button row order: Didn't know, Knew it.
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
  // which direction is active, so the reveal (read-aloud,
  // example sentence, meaning list) shows the target language, not always Spanish.
  target: PcicTarget;
  onGrade: (g: Sm2Grade) => void;
}) {
  // The old button row's interval preview per grade (lib/sm2.ts
  // sm2PreviewDays), formatted with i18n (not only in Hungarian).
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

  // if the typed answer exactly matches the target letter for letter and accent
  // (ignoring case and edge whitespace), the green echo is left out, the
  // word is shown only once (the pink line with the speaker).
  const typedExact = typedAnswer.trim().toLowerCase() === grade.best.trim().toLowerCase();

  // if the answer has several alternatives (e.g. "el carro /
  // el coche"), the others are shown under the displayed correct form, so the learner knows which else is right.
  const alsoAlternatives = pcicAlternatives(target === 'es' ? currentItem.es : currentItem.en).filter(
    (alt) => alt !== grade.best
  );
  // on an empty / wrong answer, the other accepted forms are shown next to the displayed form
  // in the same kind of row (not only in a small "also" row); on a right answer the "also" row stays.
  const answerColor = legibleOn(colors.tint, colors.card, textContrastMin(skin, 'word', 22, true));
  const showAllAccepted = nextGrade !== 'good';

  return (
    <>
      <View style={styles.resultSection}>
        {/* a single right / wrong signal, identical on every card (colour + shape + ✓/✗ + text). */}
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
          <Text testID="pcic-correct-answer" variant="word" style={[styles.correctAnswer, { color: answerColor }]}>{grade.best}</Text>
          <Pressable onPress={() => speak(grade.best, speechLang(target))} style={styles.speakBtn}>
            <Text style={styles.speakIcon}>🔊</Text>
            <SkinSpeakLabel />
          </Pressable>
        </View>
        {showAllAccepted && alsoAlternatives.map((alt, i) => (
          <View key={alt} style={styles.frontRow}>
            <Text testID={`pcic-correct-answer-${i + 2}`} variant="word" style={[styles.correctAnswer, { color: answerColor }]}>{alt}</Text>
            <Pressable onPress={() => speak(alt, speechLang(target))} style={styles.speakBtn}>
              <Text style={styles.speakIcon}>🔊</Text>
              <SkinSpeakLabel />
            </Pressable>
          </View>
        ))}
        {!showAllAccepted && alsoAlternatives.length > 0 && (
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
        {/* accent strictness OFF + accent-only mismatch
            -> besides the yellow marking in the diff, it is also stated explicitly as counting for 100%. */}
        {grade.accentOnly && (
          <Text style={[styles.accentNote, { color: colors.tabIconDefault }]}>{s.pcic.accentForgiven}</Text>
        )}
        {/* example sentence under the solution, only after Check
            and only if there is a match in the corpus (currentItem.exampleEs).
            It is in the target language, the other language is the gloss. */}
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

      {/* the old (pre-PR #27) Knew it / Didn't know
          button row is back, with the interval preview; the tap decides and
          grades, even after an empty submit. */}
      <View testID="pcic-grades" style={[styles.gradesRow, g.brutal && styles.brutalGradesRow, g.brutal && stacked && styles.gradesStacked]}>
        {GRADES.map((gr) => {
          const isPre = nextGrade === gr;
          if (g.brutal) {
            // box (good = a, again = b). The two buttons are
            // identical (same shadow offset, the row spans the card's full width).
            // The theme's button variant: senior = stacked + icon, zen = text only,
            // the "Knew it" underlined.
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
  // there must be a visible gap between the "Not quite!" badge and the typed (wrong) word (it used to be 0 px, the two elements touched).
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
  // "also: b · c" row under the correct form.
  alsoLine: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
  alsoAlt: {
    fontWeight: '700',
  },
  // "Missing accent, counted as correct" row.
  accentNote: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  // example sentence under the solution, after Check.
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
  // Senior: the two buttons stacked, full width.
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
