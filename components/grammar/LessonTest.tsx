import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Colors from '@/constants/Colors';
import { fontSize, fontWeight, radius, spacing } from '@/constants/Theme';
import { getDb } from '@/lib/database';
import { examPassed } from '@/lib/exam/score';
import { t } from '@/lib/i18n';
import type { GrammarTopicData } from '@/lib/games/content';
import {
  LESSON_TEST_PASS_PCT,
  buildLessonTest,
  mergeLessonTestResult,
  type LessonTestQuestion,
  type LessonTestResult,
} from '@/lib/grammar/lessonTest';
import { useGrammarColors } from '@/lib/grammarColors';
import { useTheme } from '@/lib/ThemeContext';
import { localDateString } from '@/lib/usageStats';
import { Card, SegmentBar, segmentsFilled } from '@/components/grammar/Brutal';
import ResultBadge from '@/components/ResultBadge';
import ExamButton from '@/components/exam/ExamButton';
import ExamChoiceCard from '@/components/exam/ExamChoiceCard';
import ExamMatchCard from '@/components/exam/ExamMatchCard';
import ExamTilesCard from '@/components/exam/ExamTilesCard';
import ExamTypeCard from '@/components/exam/ExamTypeCard';

// PLAN-vizsga B. szakasz (8. lépés): a nyelvtani lecke végi teszt képernyője. Nincs bevezető
// (a lecke done-lapjának gombja alatt áll "10 questions, pass 80%"): kérdések (nincs élet; a
// helyes válasz után nincs visszajelzés, a hibás után a helyes látszik, mint a szintvizsgán) ->
// eredmény (az elrontott tételek a helyes válasszal és a lecke magyarázatával). A bukás nem
// zár le semmit (B4 a), az újrapróba új tételeket húz. A mentést a szülő végzi (`onSave`).

type Phase = 'running' | 'leaving' | 'result';
type Answered = { q: LessonTestQuestion; correct: boolean };

interface Summary {
  correct: number;
  total: number;
  pct: number;
  passed: boolean;
  missed: LessonTestQuestion['review'][];
}

interface Props {
  lesson: GrammarTopicData;
  topicId: string;
  learnedLang: string;
  contentLang: string;
  /** A korábbi mentett eredmény (az elrontott tételek előre kerülnek, a legjobb pont megmarad). */
  previous: LessonTestResult | null;
  hasNextTopic: boolean;
  onSave: (result: LessonTestResult) => void;
  onNextTopic: () => void;
  onBackToRule: () => void;
  onBackToSyllabus: () => void;
  /** A ✕ megerősítése után: vissza a leckéhez, mentés nélkül. */
  onLeave: () => void;
}

function QuestionView({
  q,
  learnedLang,
  strictAccents,
  onDone,
}: {
  q: LessonTestQuestion;
  learnedLang: string;
  strictAccents: boolean;
  onDone: (correct: boolean) => void;
}) {
  const v = q.view;
  switch (v.card) {
    case 'choice':
      return <ExamChoiceCard heading={v.heading} text={v.text} options={v.options} correctIndex={v.correctIndex} onDone={onDone} />;
    case 'type':
      return (
        <ExamTypeCard
          prompt={v.prompt}
          hint={v.hint}
          answer={v.answer}
          accept={v.accept}
          sentence={v.sentence}
          targetLang={learnedLang}
          strictAccents={strictAccents}
          onDone={onDone}
        />
      );
    case 'tiles':
      return <ExamTilesCard prompt={v.prompt} answerTokens={v.answerTokens} sentence={v.sentence} distractors={[]} onDone={onDone} />;
    case 'match':
      return <ExamMatchCard pairs={v.pairs} onDone={onDone} />;
  }
}

export default function LessonTest({
  lesson,
  topicId,
  learnedLang,
  contentLang,
  previous,
  hasNextTopic,
  onSave,
  onNextTopic,
  onBackToRule,
  onBackToSyllabus,
  onLeave,
}: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t();

  // A kiosztás: a kérdések, az eddig feltett tételek (újrapróba: új tételek előre) és az utolsó
  // próba elrontottjai (a következő próba ezeket húzza előre).
  const deal = (missed: ReadonlySet<string>, used: ReadonlySet<string>) => {
    const qs = buildLessonTest(lesson, {
      seed: Date.now(),
      learnedLang,
      contentLang,
      missedBefore: missed,
      avoid: used,
    });
    return { questions: qs, used: new Set([...used, ...qs.map((q) => q.id)]), missed };
  };

  const [strictAccents, setStrictAccents] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<Phase>('running');
  const [dealt, setDealt] = useState(() => deal(new Set(previous?.missed ?? []), new Set()));
  const questions = dealt.questions;
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answered[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    let alive = true;
    getDb()
      .getStrictAccents()
      .then((v) => alive && setStrictAccents(v))
      .catch(() => alive && setStrictAccents(false));
    return () => {
      alive = false;
    };
  }, []);

  const finish = (all: Answered[]) => {
    const correct = all.filter((a) => a.correct).length;
    const total = all.length;
    const missedQs = all.filter((a) => !a.correct).map((a) => a.q);
    setDealt((d) => ({ ...d, missed: new Set(missedQs.map((q) => q.id)) }));
    const merged = mergeLessonTestResult(previous, correct, total, localDateString(), missedQs.map((q) => q.id));
    onSave(merged);
    setSummary({
      correct,
      total,
      pct: merged.last,
      passed: examPassed(correct, total),
      missed: missedQs.map((q) => q.review),
    });
    setPhase('result');
  };

  const answered = (correct: boolean) => {
    const all = [...answers, { q: questions[index], correct }];
    setAnswers(all);
    if (index + 1 >= questions.length) finish(all);
    else setIndex(index + 1);
  };

  const retry = () => {
    setDealt((d) => deal(d.missed, d.used));
    setIndex(0);
    setAnswers([]);
    setSummary(null);
    setPhase('running');
  };

  const shell = (children: ReactNode) => <View style={[styles.screen, { backgroundColor: colors.background }]}>{children}</View>;

  if (phase === 'result' && summary) {
    return shell(
      <ScrollView contentContainerStyle={styles.body}>
        <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
          <ResultBadge
            testID="lesson-test-verdict"
            correct={summary.passed}
            label={summary.passed ? s.lessonTest.verdictPassed : s.exam.notYet}
          />
          <Text testID="lesson-test-score" style={[styles.title, { color: colors.text }]}>
            {s.exam.score(summary.correct, summary.total, summary.pct)}
          </Text>
          {!summary.passed && <Text style={[styles.line, { color: colors.textMuted }]}>{s.exam.needPass(LESSON_TEST_PASS_PCT)}</Text>}
        </Card>
        {summary.missed.length > 0 && (
          <View testID="lesson-test-missed" style={styles.missedList}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{s.lessonTest.missedTitle}</Text>
            {summary.missed.map((m, i) => (
              <Card key={i} classicStyle={styles.card} boxStyle={styles.brutalCard}>
                <Text style={[styles.missedQuestion, { color: colors.text }]}>{m.question}</Text>
                {m.answer !== '' && (
                  <>
                    <Text style={[styles.missedLabel, { color: colors.textMuted }]}>{s.exam.correctAnswer}</Text>
                    <Text style={[styles.missedAnswer, { color: colors.success }]}>{m.answer}</Text>
                  </>
                )}
                {m.why ? <Text style={[styles.missedWhy, { color: colors.textMuted }]}>{m.why}</Text> : null}
              </Card>
            ))}
          </View>
        )}
        {summary.passed ? (
          <>
            {hasNextTopic && <ExamButton testID="lesson-test-next-topic" label={s.grammar.nextTopic} onPress={onNextTopic} />}
            <ExamButton testID="lesson-test-back-syllabus" secondary={hasNextTopic} label={s.grammar.backToSyllabus} onPress={onBackToSyllabus} />
          </>
        ) : (
          <>
            <ExamButton testID="lesson-test-back-rule" label={s.grammar.backToRule} onPress={onBackToRule} />
            <ExamButton testID="lesson-test-retry" secondary label={s.exam.tryAgain} onPress={retry} />
          </>
        )}
      </ScrollView>
    );
  }

  if (phase === 'leaving') {
    return shell(
      <View style={styles.body}>
        <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
          <Text style={[styles.title, { color: colors.text }]}>{s.lessonTest.leaveTitle}</Text>
          <Text style={[styles.line, { color: colors.textMuted }]}>{s.exam.leaveBody}</Text>
        </Card>
        <ExamButton testID="lesson-test-leave" label={s.exam.leave} onPress={onLeave} />
        <ExamButton testID="lesson-test-keep-going" secondary label={s.exam.keepGoing} onPress={() => setPhase('running')} />
      </View>
    );
  }

  if (strictAccents === null || questions.length === 0) {
    return shell(<ActivityIndicator style={styles.centered} color={colors.tint} />);
  }

  const pct = questions.length > 0 ? (index / questions.length) * 100 : 0;
  return shell(
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Pressable testID="lesson-test-close" accessibilityRole="button" accessibilityLabel={s.lessonTest.leaveTitle} hitSlop={12} onPress={() => setPhase('leaving')}>
          <Text style={[styles.close, { color: colors.textMuted }]}>✕</Text>
        </Pressable>
        <Text testID="lesson-test-counter" style={[styles.counter, { color: colors.textMuted }]}>
          {s.exam.question(index + 1, questions.length)}
        </Text>
        <View style={styles.closeSpacer} />
      </View>
      {g.brutal ? (
        <SegmentBar testID="lesson-test-progress" filled={segmentsFilled(pct, 8)} segments={8} style={styles.brutalProgress} />
      ) : (
        <View style={[styles.track, { backgroundColor: colors.border }]}>
          <View style={[styles.fill, { backgroundColor: colors.tint, width: `${pct}%` }]} />
        </View>
      )}
      {questions[index] && (
        <QuestionView key={`${topicId}:${index}:${questions[index].id}`} q={questions[index]} learnedLang={learnedLang} strictAccents={strictAccents} onDone={answered} />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: spacing.xl },
  flex: { flex: 1 },
  centered: { flex: 1 },
  body: { padding: spacing.lg, gap: spacing.md },
  card: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  brutalCard: { padding: spacing.lg, gap: spacing.md },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, textAlign: 'center' },
  line: { fontSize: fontSize.md, textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg },
  close: { fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  closeSpacer: { width: fontSize.xl },
  counter: { fontSize: fontSize.sm },
  track: { height: 8, borderRadius: radius.xs, marginHorizontal: spacing.lg, marginTop: spacing.sm, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.xs },
  brutalProgress: { marginHorizontal: spacing.lg, marginTop: spacing.sm },
  missedList: { gap: spacing.md },
  sectionTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, textTransform: 'uppercase' },
  missedQuestion: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  missedLabel: { fontSize: fontSize.sm },
  missedAnswer: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  missedWhy: { fontSize: fontSize.sm },
});
