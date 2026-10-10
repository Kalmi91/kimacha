import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { fontSize, fontWeight, radius, spacing } from '@/constants/Theme';
import { getDb } from '@/lib/database';
import { getPcicTarget, pcicItemsForLevel, type PcicLevel, type PcicTarget } from '@/data/pcic';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/ThemeContext';
import { localDateString } from '@/lib/usageStats';
import { levelProgress } from '@/lib/pcicLevels';
import type { Sm2Card } from '@/lib/sm2';
import { Card } from '@/components/grammar/Brutal';
import LevelRow from '@/components/LevelRow';
import FeedbackButton from '@/components/FeedbackModal';
import { FAB_CLEARANCE } from '@/components/learn/DockedAction';
import ExamButton from '@/components/exam/ExamButton';
import PlacementQuestionCard from '@/components/exam/PlacementQuestionCard';
import { placementAnswer, placementBreakdown, placementFinish, placementStart, type PlacementState } from '@/lib/exam/placement';
import { saveKnownWords } from '@/lib/exam/placementKnown';
import {
  buildPlacementQuestion,
  placementLevels,
  placementPoolFor,
  placementQuestionKey,
  type PlacementPool,
  type PlacementQuestion,
} from '@/lib/exam/placementQuestions';

// The adaptive placement-test screen. The entry points are the onboarding level step and the level-picker
// sheet; the questions come right here (stepped, starting from A2, at most 20) with no feedback; at the end
// a suggested starting level is shown, which can be overridden. Correctly answered words graduate
// (lib/exam/placementKnown.ts), the level is saved by "Start at". In onboarding (no saved
// direction yet) saving also records the direction.

interface Run {
  target: PcicTarget;
  seed: number;
  pools: Partial<Record<PcicLevel, PlacementPool>>;
  placement: PlacementState;
  question?: PlacementQuestion;
  used: string[];
  correctWords: string[];
}

function startRun(target: PcicTarget, seed: number): Run | null {
  const levels = placementLevels();
  if (levels.length === 0) return null;
  const pools: Partial<Record<PcicLevel, PlacementPool>> = {};
  for (const level of levels) pools[level] = placementPoolFor(level, target);
  const placement = placementStart(levels);
  const question = buildPlacementQuestion({
    level: placement.current,
    position: placement.blockAsked,
    target,
    pool: pools[placement.current]!,
    used: new Set(),
    seed,
  });
  return { target, seed, pools, placement: question ? placement : placementFinish(placement), question, used: [], correctWords: [] };
}

function LevelDots({ levels, current }: { levels: PcicLevel[]; current: PcicLevel }) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  return (
    <View testID="placement-levels" style={styles.dots}>
      {levels.map((level) => (
        <View key={level} style={[styles.dot, { borderColor: colors.border, backgroundColor: level === current ? colors.tint : 'transparent' }]}>
          <Text style={[styles.dotText, { color: level === current ? colors.onTint : colors.textMuted }]}>{level}</Text>
        </View>
      ))}
    </View>
  );
}

export default function PlacementScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();
  const router = useRouter();

  // Starts on the first render (the level data is an already-loaded module, in the web preview too, without a seed).
  const [run, setRun] = useState<Run | null>(() => startRun(getPcicTarget(), Date.now()));
  const [leaving, setLeaving] = useState(false);
  const [known, setKnown] = useState(0);
  const [cards, setCards] = useState<Sm2Card[]>([]);
  const [choosing, setChoosing] = useState(false);

  const finish = async (words: string[]) => {
    const db = getDb();
    setKnown(await saveKnownWords(db, words, localDateString()));
    setCards(await db.getPcicCards());
  };

  const answered = (correct: boolean) => {
    if (!run || !run.question || run.placement.done) return;
    const used = [...run.used, placementQuestionKey(run.question)];
    const correctWords = correct && run.question.kind === 'word' ? [...run.correctWords, run.question.itemId] : run.correctWords;
    let placement = placementAnswer(run.placement, correct);
    let question: PlacementQuestion | undefined;
    if (!placement.done) {
      question = buildPlacementQuestion({
        level: placement.current,
        position: placement.blockAsked,
        target: run.target,
        pool: run.pools[placement.current]!,
        used: new Set(used),
        seed: run.seed,
      });
      // The question pool is exhausted: gives a suggestion from the measurement so far.
      if (!question) placement = placementFinish(placement);
    }
    setRun({ ...run, placement, question, used, correctWords });
    if (placement.done) finish(correctWords);
  };

  const again = () => {
    setChoosing(false);
    setKnown(0);
    setRun(startRun(getPcicTarget(), Date.now()));
  };

  // Saves the suggested or manually chosen level. In onboarding (no saved direction yet)
  // it also records the direction and moves on to the tabs; coming from the level-picker sheet it steps back to the learner tab.
  const chooseLevel = async (level: PcicLevel) => {
    const db = getDb();
    if (!(await db.getOnboarding())) {
      const target = getPcicTarget();
      await db.setOnboarding(target === 'es' ? 'en' : 'es', target);
      await db.setPcicLevel(level);
      router.replace('/(tabs)');
      return;
    }
    await db.setPcicLevel(level);
    router.back();
  };

  // The 💬 button is on every part of the placement test; `part` tells the Feedback sheet
  // exactly which part it is about (placement:<part>).
  const fbTarget = run?.target ?? getPcicTarget();
  const pair = `${fbTarget === 'es' ? 'en' : 'es'}→${fbTarget}`;
  const shell = (children: ReactNode, part: string) => (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {children}
      <FeedbackButton level={run?.placement.current ?? 'A1'} languagePair={pair} currentCard={`placement:${part}`} />
    </View>
  );

  if (run === null) {
    return shell(
      <View style={styles.body}>
        <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
          <Text style={[styles.line, { color: colors.textMuted }]}>{s.placement.emptyBody}</Text>
        </Card>
        <ExamButton testID="placement-back" label={s.exam.back} onPress={() => router.back()} />
      </View>,
      'empty',
    );
  }

  const { placement } = run;

  if (placement.done && placement.placed) {
    const levelLabels: Record<PcicLevel, string> = {
      A1: s.pcic.levelBeginner,
      A2: s.pcic.levelElementary,
      B1: s.pcic.levelIntermediate,
      B2: s.pcic.levelUpperIntermediate,
      C1: s.pcic.levelAdvanced,
    };
    const placed = placement.placed;
    return shell(
      <ScrollView contentContainerStyle={styles.body}>
        <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
          <Text testID="placement-result" style={[styles.title, { color: colors.text }]}>
            {s.placement.suggestedStart(placed)}
          </Text>
          <Text testID="placement-breakdown" style={[styles.line, { color: colors.text }]}>
            {placementBreakdown(placement)
              .map((b) => s.placement.levelScore(b.level, b.correct, b.asked))
              .join(', ')}
          </Text>
          <Text style={[styles.line, { color: colors.textMuted }]}>{s.placement.levelNote[placed]}</Text>
          {known > 0 && <Text testID="placement-known" style={[styles.line, { color: colors.textMuted }]}>{s.placement.knownWords(known)}</Text>}
        </Card>
        <ExamButton testID="placement-start" label={s.placement.startAt(placed)} onPress={() => chooseLevel(placed)} />
        <ExamButton testID="placement-choose" secondary label={s.placement.chooseOther} onPress={() => setChoosing(!choosing)} />
        {choosing &&
          placement.levels.map((level) => {
            const total = pcicItemsForLevel(level).length;
            return (
              <LevelRow
                key={level}
                level={level}
                label={levelLabels[level]}
                introduced={levelProgress(cards, level, total).introduced}
                total={total}
                active={level === placed}
                colors={colors}
                onPress={() => chooseLevel(level)}
              />
            );
          })}
        <ExamButton testID="placement-again" secondary label={s.placement.again} onPress={again} />
      </ScrollView>,
      'result',
    );
  }

  if (leaving) {
    return shell(
      <View style={styles.body}>
        <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
          <Text style={[styles.title, { color: colors.text }]}>{s.placement.leaveTitle}</Text>
          <Text style={[styles.line, { color: colors.textMuted }]}>{s.placement.leaveBody}</Text>
        </Card>
        <ExamButton testID="placement-leave" label={s.exam.leave} onPress={() => router.back()} />
        <ExamButton testID="placement-keep-going" secondary label={s.exam.keepGoing} onPress={() => setLeaving(false)} />
      </View>,
      'leave',
    );
  }

  const q = run.question;
  return shell(
    <View style={styles.flex}>
      <View style={styles.header}>
        <Pressable testID="placement-close" accessibilityRole="button" accessibilityLabel={s.placement.leaveTitle} hitSlop={12} onPress={() => setLeaving(true)}>
          <Text style={[styles.close, { color: colors.textMuted }]}>✕</Text>
        </Pressable>
        <Text testID="placement-counter" style={[styles.counter, { color: colors.textMuted }]}>
          {s.placement.question(placement.asked + 1)}
        </Text>
        <View style={styles.closeSpacer} />
      </View>
      <LevelDots levels={placement.levels} current={placement.current} />
      {q && (
        <PlacementQuestionCard
          key={placement.asked}
          heading={q.kind === 'gap' ? s.exam.chooseGap : undefined}
          text={q.kind === 'word' ? s.placement.wordQuestion(q.word) : q.sentence}
          options={q.options}
          correctIndex={q.correctIndex}
          onDone={answered}
        />
      )}
    </View>,
    q ? `q${placement.asked + 1}:${q.kind}` : `q${placement.asked + 1}`,
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: spacing.xl },
  flex: { flex: 1 },
  body: { padding: spacing.lg, paddingBottom: FAB_CLEARANCE, gap: spacing.md },
  card: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  brutalCard: { padding: spacing.lg, gap: spacing.md },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, textAlign: 'center' },
  line: { fontSize: fontSize.md, textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg },
  close: { fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  closeSpacer: { width: fontSize.xl },
  counter: { fontSize: fontSize.sm },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.sm },
  dot: { minWidth: 44, alignItems: 'center', borderRadius: radius.full, borderWidth: 1, paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
  dotText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
});
