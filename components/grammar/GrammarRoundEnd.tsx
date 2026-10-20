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
import { TRANSFORM_ROUND_SIZE } from '@/lib/grammar/transformRounds';
import { LESSON_TEST_PASS_PCT, lessonTestSize, lessonTestUnlocked, type LessonTestResult } from '@/lib/grammar/lessonTest';
import type { Phase, ProgressRow } from '@/lib/grammar/useGrammarTopic';
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
  streak: number;
  prevPct: number | null;
  drillKind: GrammarKind;
  kindCounts: Record<GrammarKind, number>;
  lessonTestResult: LessonTestResult | null;
  header: ReactElement;
  lessonScoreOf: (rows: ProgressRow[]) => number | null;
  setPhase: (phase: Phase) => void;
  setScore: (score: null) => void;
}

export default function GrammarRoundEnd({
  score,
  topicId,
  learnedLang,
  contentLang,
  lesson,
  progressRows,
  roundStats,
  streak,
  prevPct,
  drillKind,
  kindCounts,
  lessonTestResult,
  header,
  lessonScoreOf,
  setPhase,
  setScore,
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
  // The "Lesson test" button on the done page; it is only enabled once a round has been played in every
  // task kind of the lesson, until then it is grey with the to-do below it. The line under the button is the rule.
  const testSize = lessonTestSize(lesson, learnedLang, contentLang);
  const testReady = lessonTestUnlocked(lesson, progressRows, String(topicId));
  const startTest = () => setPhase('test');
  const lessonTestCta =
    testSize > 0 ? (
      <>
        {g.brutal ? (
          <BrutalBox
            testID="grammar-start-lessontest"
            fill={testReady ? 'a' : 'paper'}
            dashed={!testReady}
            disabled={!testReady}
            style={styles.brutalBtnWrap}
            boxStyle={styles.brutalBtn}
            onPress={startTest}
          >
            <Text style={[styles.brutalBtnText, { color: testReady ? g.onFill : g.mu }]}>{s.lessonTest.take}</Text>
          </BrutalBox>
        ) : (
          <Pressable
            testID="grammar-start-lessontest"
            disabled={!testReady}
            style={[
              styles.btn,
              testReady ? { backgroundColor: colors.tint } : { borderWidth: 1.5, borderColor: colors.tabIconDefault, opacity: 0.5 },
            ]}
            onPress={startTest}
          >
            <Text style={[styles.btnText, testReady ? styles.btnTextOnTint : { color: colors.tabIconDefault }]}>{s.lessonTest.take}</Text>
          </Pressable>
        )}
        <Text testID="grammar-lessontest-note" style={[styles.lessonTestNote, { color: mutedColor(g, colors.tabIconDefault) }]}>
          {!testReady
            ? s.lessonTest.finishFirst
            : lessonTestResult?.passed
              ? s.lessonTest.passedBest(lessonTestResult.best)
              : s.lessonTest.rules(testSize, LESSON_TEST_PASS_PCT)}
        </Text>
      </>
    ) : null;
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
            {stat(s.grammar.statStreak, `🔥 ${streak}`, 'b')}
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

          {lessonTestCta}
          {next ? (
            <BrutalBox
              testID="grammar-next-topic"
              style={styles.brutalBtnWrap}
              boxStyle={styles.brutalBtn}
              onPress={() => router.replace(`/grammar/${next.id}` as never)}
            >
              <Text style={[styles.brutalBtnText, { color: g.ink }]}>{s.grammar.nextTopic} →</Text>
            </BrutalBox>
          ) : null}
          <BrutalBox style={styles.brutalBtnWrap} boxStyle={styles.brutalBtn} onPress={() => setPhase('lesson')}>
            <Text style={[styles.brutalBtnText, { color: g.ink }]}>{s.grammar.backToRule}</Text>
          </BrutalBox>
          {drillKind === 'transform' && kindCounts.transform > TRANSFORM_ROUND_SIZE ? (
            <BrutalBox
              testID="grammar-more-round"
              fill="a"
              style={styles.brutalBtnWrap}
              boxStyle={styles.brutalBtn}
              onPress={() => {
                setScore(null);
                setPhase('drill');
              }}
            >
              <Text style={[styles.brutalBtnText, { color: g.onFill }]}>{s.grammar.moreRound(TRANSFORM_ROUND_SIZE)}</Text>
            </BrutalBox>
          ) : null}
          <Pressable
            testID="grammar-practice-again"
            style={styles.ghostBtn}
            onPress={() => {
              setScore(null);
              setPhase('drill');
            }}
          >
            <Text style={[styles.brutalUnderline, { color: g.ink }]}>{s.grammar.oneMoreRound}</Text>
          </Pressable>
          <Pressable style={styles.ghostBtn} onPress={() => router.back()}>
            <Text style={[styles.ghostBtnText, { color: g.mu }]}>{s.grammar.backToSyllabus}</Text>
          </Pressable>
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
        {lessonTestCta}
        {next ? (
          <Pressable
            testID="grammar-next-topic"
            style={[styles.btn, { borderWidth: 1.5, borderColor: colors.tint }]}
            onPress={() => router.replace(`/grammar/${next.id}` as never)}
          >
            <Text style={[styles.btnText, { color: colors.tint }]}>{s.grammar.nextTopic}</Text>
          </Pressable>
        ) : null}
        <Pressable
          style={[
            styles.btn,
            (pct >= 80 && next) || testSize > 0 ? { borderWidth: 1.5, borderColor: colors.tint } : { backgroundColor: colors.tint },
          ]}
          onPress={() => setPhase('lesson')}
        >
          <Text
            style={[
              styles.btnText,
              (pct >= 80 && next) || testSize > 0 ? { color: colors.tint } : styles.btnTextOnTint,
            ]}
          >
            {s.grammar.backToRule}
          </Text>
        </Pressable>
        <Pressable
          testID="grammar-practice-again"
          style={[styles.btn, { borderWidth: 1.5, borderColor: colors.tint }]}
          onPress={() => {
            setScore(null);
            setPhase('drill');
          }}
        >
          <Text style={[styles.btnText, { color: colors.tint }]}>{s.grammar.practiceAgain}</Text>
        </Pressable>
        {/* on a big (>10 items) transform lesson, a separate button for the
            next round of 10, the same tangible step as
            "Practice again", plus the fresh `transformSeen` map reflects it. */}
        {drillKind === 'transform' && kindCounts.transform > TRANSFORM_ROUND_SIZE ? (
          <Pressable
            testID="grammar-more-round"
            style={[styles.btn, { backgroundColor: colors.tint }]}
            onPress={() => {
              setScore(null);
              setPhase('drill');
            }}
          >
            <Text style={[styles.btnText, styles.btnTextOnTint]}>{s.grammar.moreRound(TRANSFORM_ROUND_SIZE)}</Text>
          </Pressable>
        ) : null}
        <Pressable style={styles.ghostBtn} onPress={() => router.back()}>
          <Text style={[styles.ghostBtnText, { color: colors.tabIconDefault }]}>{s.grammar.backToSyllabus}</Text>
        </Pressable>
      </View>
    </View>
  );
}
