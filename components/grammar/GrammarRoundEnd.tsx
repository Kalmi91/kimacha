import type { ReactElement } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/KText';
import { useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import type { GrammarKind, GrammarTopicData } from '@/lib/games/content';
import { nextWrittenTopic } from '@/lib/grammar/syllabus';
import { LESSON_TEST_PASS_PCT, lessonTestSize, lessonTestUnlocked, type LessonTestResult } from '@/lib/grammar/lessonTest';
import { KIND_ORDER, type Phase, type ProgressRow } from '@/lib/grammar/useGrammarTopic';
import type { RoundStats } from '@/components/grammar/GrammarDrill';
import { BrutalBox, SegmentBar, Sticker, segmentsFilled, mutedColor } from '@/components/grammar/Brutal';
import { styles } from '@/components/grammar/GrammarTopic.styles';

// The round-end ("done") screen of a grammar lesson: score, stats, next steps.
interface Props {
  score: { correct: number; total: number };
  topicId: string;
  learnedLang: string;
  contentLang: string;
  lesson: GrammarTopicData;
  progressRows: ProgressRow[];
  roundStats: RoundStats | null;
  prevPct: number | null;
  drillKind: GrammarKind;
  kindCounts: Record<GrammarKind, number>;
  lessonTestResult: LessonTestResult | null;
  onStartTest: () => void;
  header: ReactElement;
  lessonScoreOf: (rows: ProgressRow[]) => number | null;
  setPhase: (phase: Phase) => void;
  setScore: (score: null) => void;
  setDrillKind: (kind: GrammarKind) => void;
}

export default function GrammarRoundEnd({
  score,
  topicId,
  learnedLang,
  contentLang,
  lesson,
  progressRows,
  roundStats,
  prevPct,
  drillKind,
  kindCounts,
  lessonTestResult,
  onStartTest,
  header,
  lessonScoreOf,
  setPhase,
  setScore,
  setDrillKind,
}: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t();
  const router = useRouter();
  const pct = score.total ? Math.round((score.correct / score.total) * 100) : 0;
  // so one can move on from the Done screen to the next
  // topic. Offered only for a written lesson; we don't send anyone to an empty screen.
  const next = nextWrittenTopic(learnedLang, String(topicId));
  // the cumulative ratio computed from ALL rounds of the lesson so far, not just
  // this round's score (which is `pct` above).
  const cumulativePct = lessonScoreOf(progressRows);
  // The test button is the only filled (highlighted) button on the page, the others are secondary (outlined).
  // The round end has three buttons: retake this kind, back to the course, next test type. The line under them is the
  // lesson-test rule; the lesson test itself opens only after the last kind (and only once a round was played in every kind).
  const testSize = lessonTestSize(lesson, learnedLang, contentLang);
  const testReady = lessonTestUnlocked(lesson, progressRows, String(topicId));
  const lessonTestNote =
    testSize > 0 ? (
      <Text testID="grammar-lessontest-note" style={[styles.lessonTestNote, { color: mutedColor(g, colors.tabIconDefault) }]}>
        {!testReady
          ? s.lessonTest.finishFirst
          : lessonTestResult?.passed
            ? s.lessonTest.passedBest(lessonTestResult.best)
            : s.lessonTest.rules(testSize, LESSON_TEST_PASS_PCT)}
      </Text>
    ) : null;
  const retake = () => {
    setScore(null);
    setPhase('drill');
  };
  // "Next test type": the lesson's next kind in KIND_ORDER (started as the lesson page's kind buttons do), after the last
  // one the lesson test (if ready), else the next topic; if none of these exist the button is not shown.
  const availableKinds = KIND_ORDER.filter((k) => kindCounts[k] > 0);
  const nextKind = availableKinds[availableKinds.indexOf(drillKind) + 1] as GrammarKind | undefined;
  const nextStep: (() => void) | null = nextKind
    ? () => {
        setScore(null);
        setDrillKind(nextKind);
        setPhase('drill');
      }
    : testSize > 0 && testReady
      ? onStartTest
      : next
        ? () => router.replace(`/grammar/${next.id}` as never)
        : null;
  // Neo-brutalist: big
  // correct-ratio in the filled box + combo sticker, 3 small boxes, "practice
  // this" with the wrong sentence, topic progress in segments, buttons.
  if (g.brutal) {
    const secs = roundStats?.seconds ?? 0;
    const time = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    const miss = roundStats?.miss ?? null;
    const missAt = miss ? miss.sentence.indexOf(miss.highlight) : -1;
    const stat = (label: string, value: string, fill: 'paper' | 'b') => (
      <BrutalBox fill={fill} style={styles.brutalStatWrap} boxStyle={styles.brutalStat}>
        <Text style={[styles.brutalStatValue, { color: fill === 'b' ? g.onB : g.ink }]}>{value}</Text>
        <Text style={[styles.brutalStatLabel, { color: fill === 'b' ? g.onB : g.mu }]}>{label}</Text>
      </BrutalBox>
    );
    return (
      <View style={[styles.container, { backgroundColor: g.bg }]}>
        {header}
        <ScrollView contentContainerStyle={styles.brutalDoneBody}>
          <BrutalBox testID="grammar-score" fill="a" boxStyle={styles.brutalScoreBox}>
            <Text style={[styles.brutalScore, { color: g.onFill }]}>
              {score.correct}/{score.total}
            </Text>
            <Text style={[styles.brutalNote, { color: g.onFill }]}>{pct >= 80 ? s.grammar.doneGood : s.grammar.doneAgain}</Text>
            {roundStats && roundStats.bestCombo >= 2 ? (
              <View style={styles.brutalComboPos}>
                <Sticker testID="grammar-best-combo" label={s.grammar.comboLabel(roundStats.bestCombo)} fill="b" rotate={6} />
              </View>
            ) : null}
          </BrutalBox>

          <View style={styles.brutalStats}>
            {stat(s.grammar.statCorrect, String(score.correct), 'paper')}
            {stat(s.grammar.statTime, time, 'paper')}
          </View>

          {cumulativePct !== null ? (
            <BrutalBox boxStyle={styles.brutalProgressBox}>
              <SegmentBar segments={8} filled={segmentsFilled(cumulativePct, 8)} />
              <Text style={[styles.brutalStatLabel, { color: g.ink }]}>{s.grammar.progressChange(prevPct, cumulativePct)}</Text>
              <Text testID="grammar-lesson-percent" style={[styles.brutalStatLabel, { color: g.mu }]}>
                {s.grammar.lessonPercent(cumulativePct)}
              </Text>
            </BrutalBox>
          ) : null}

          {miss ? (
            <BrutalBox testID="grammar-practice-this" boxStyle={styles.brutalProgressBox}>
              <Text style={[styles.brutalStatLabel, { color: g.mu }]}>{s.grammar.practiceThis}</Text>
              <Text style={[styles.brutalMiss, { color: g.ink }]}>
                {missAt >= 0 ? miss.sentence.slice(0, missAt) : miss.sentence}
                {missAt >= 0 ? (
                  <Text style={{ backgroundColor: g.b, color: g.onB }}>{miss.highlight}</Text>
                ) : null}
                {missAt >= 0 ? miss.sentence.slice(missAt + miss.highlight.length) : ''}
              </Text>
            </BrutalBox>
          ) : null}

          <BrutalBox testID="grammar-practice-again" fill="a" style={styles.brutalBtnWrap} boxStyle={styles.brutalBtn} onPress={retake}>
            <Text style={[styles.brutalBtnText, { color: g.onFill }]}>{s.grammar.retakeTest}</Text>
          </BrutalBox>
          <BrutalBox testID="grammar-back-course" style={styles.brutalBtnWrap} boxStyle={styles.brutalBtn} onPress={() => router.back()}>
            <Text style={[styles.brutalBtnText, { color: g.ink }]}>{s.grammar.backToSyllabus}</Text>
          </BrutalBox>
          {nextStep ? (
            <BrutalBox testID="grammar-next-type" style={styles.brutalBtnWrap} boxStyle={styles.brutalBtn} onPress={nextStep}>
              <Text style={[styles.brutalBtnText, { color: g.ink }]}>{s.grammar.nextTestType}</Text>
            </BrutalBox>
          ) : null}
          {lessonTestNote}
        </ScrollView>
      </View>
    );
  }
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {header}
      <View style={styles.doneBody}>
        <Text style={styles.doneEmoji}>{pct >= 80 ? '🎉' : '📘'}</Text>
        <Text style={[styles.doneScore, { color: colors.text }]}>
          {score.correct} / {score.total}
        </Text>
        <Text style={[styles.doneNote, { color: colors.tabIconDefault }]}>
          {pct >= 80 ? s.grammar.doneGood : s.grammar.doneAgain}
        </Text>
        {cumulativePct !== null ? (
          <Text testID="grammar-lesson-percent" style={[styles.lessonPercentNote, { color: colors.tabIconDefault }]}>
            {s.grammar.lessonPercent(cumulativePct)}
          </Text>
        ) : null}
        <Pressable
          testID="grammar-practice-again"
          style={[styles.btn, { backgroundColor: colors.tint }]}
          onPress={retake}
        >
          <Text style={[styles.btnText, { color: colors.onTint }]}>{s.grammar.retakeTest}</Text>
        </Pressable>
        <Pressable testID="grammar-back-course" style={[styles.btn, { borderWidth: 1.5, borderColor: colors.tint }]} onPress={() => router.back()}>
          <Text style={[styles.btnText, { color: colors.tint }]}>{s.grammar.backToSyllabus}</Text>
        </Pressable>
        {nextStep ? (
          <Pressable testID="grammar-next-type" style={[styles.btn, { borderWidth: 1.5, borderColor: colors.tint }]} onPress={nextStep}>
            <Text style={[styles.btnText, { color: colors.tint }]}>{s.grammar.nextTestType}</Text>
          </Pressable>
        ) : null}
        {lessonTestNote}
      </View>
    </View>
  );
}