import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { AudioPlayer } from 'expo-audio';
import { useFocusEffect } from 'expo-router';
import { Text } from '@/components/KText';
import Colors from '@/constants/Colors';
import { fontSize, fontWeight, radius, spacing, tapTarget } from '@/constants/Theme';
import { Card } from '@/components/grammar/Brutal';
import { BackButton, themedEdgeStyle } from '@/components/grammar/Themed';
import GameFrame from '@/components/practice/GameFrame';
import XpChip from '@/components/XpChip';
import type { PcicTarget } from '@/data/pcic';
import { getDb } from '@/lib/database';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import { makeListeningPlayer } from '@/lib/listeningPlayer';
import { loadResumeValue, saveResumeValue } from '@/lib/resumeStore';
import {
  DEFAULT_RATE,
  LISTENING_PROGRESS_KEY,
  LISTENING_RATE_KEY,
  quizKeyFor,
  runKeyFor,
  RATES,
  answerQuiz,
  checkQuiz,
  clock,
  isComplete,
  itemComplete,
  newQuiz,
  listenTitle,
  newRun,
  optionOrder,
  parseQuiz,
  parseRate,
  parseRun,
  pick,
  quizAllMarked,
  quizComplete,
  quizRight,
  rightOrder,
  serializeQuiz,
  serializeRun,
  type ListeningData,
  type ListeningQuestion,
  type MatchRun,
  type QuizRun,
} from '@/lib/speech/listening';
import { awardXpThen } from '@/lib/xpAward';
import { useTheme } from '@/lib/ThemeContext';
import { localDateString } from '@/lib/usageStats';

// The "Greetings: listening" screen of the Speak tab: a player (one Play, a bar to tap or drag, Replay, speed chips) and, always
// below it, the matching task (places on the left, greetings on the right). The run is kept after every right pair, the first
// complete run writes the progress row the list shows as a tick. Leaving the screen or the tab pauses the recording.

interface Props {
  item: ListeningData;
  onBack: () => void;
  /** The first time every part of the item is finished (the progress row is written). */
  onFinished: () => void;
}

const WRONG_MS = 700;
const NO_QUESTIONS: ListeningQuestion[] = [];
const freshSeed = () => Math.floor(Math.random() * 2147483647) + 1;

export default function SpeechListen({ item, onBack, onFinished }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const sx = t().speechTab;
  const data = item;
  const target = data.lang as PcicTarget;
  const pairs = data.pairs;
  const n = pairs.length;
  const questions = data.questions ?? NO_QUESTIONS;
  const runKey = runKeyFor(data);
  const quizKey = quizKeyFor(data);

  const player = useRef<AudioPlayer | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [length, setLength] = useState(0);
  const [rate, setRate] = useState(DEFAULT_RATE);
  const rateRef = useRef(DEFAULT_RATE);
  const [dragFraction, setDragFraction] = useState<number | null>(null);

  const [run, setRun] = useState<MatchRun>(() => newRun(freshSeed()));
  const [quiz, setQuiz] = useState<QuizRun>(() => newQuiz(questions.length, freshSeed()));
  // the latest quiz run, set before the state: two fast taps on one question must not pay twice
  const quizRef = useRef(quiz);
  const [restored, setRestored] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  const [right, setRight] = useState<number | null>(null);
  const [wrong, setWrong] = useState<{ left: number; right: number } | null>(null);
  const wrongTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reported = useRef(false);

  const applyRate = (p: AudioPlayer, next: number) => {
    p.shouldCorrectPitch = true;
    p.setPlaybackRate(next, 'high');
  };

  useEffect(() => {
    let alive = true;
    const p = makeListeningPlayer(data.id);
    player.current = p;
    p.shouldCorrectPitch = true;
    const sub = p.addListener('playbackStatusUpdate', (s) => {
      if (!alive) return;
      setPlaying(Boolean(s.playing) && !s.didJustFinish);
      setPosition(s.didJustFinish ? 0 : s.currentTime);
      if (s.duration > 0) setLength(s.duration);
    });
    void (async () => {
      const db = getDb();
      const saved = parseRate(await loadResumeValue(db, LISTENING_RATE_KEY));
      const savedRun = parseRun(await loadResumeValue(db, runKey), n);
      const savedQuiz = parseQuiz(await loadResumeValue(db, quizKey), questions);
      if (!alive) return;
      rateRef.current = saved;
      setRate(saved);
      if (saved !== DEFAULT_RATE) applyRate(p, saved);
      if (savedRun) setRun(savedRun);
      if (savedQuiz) {
        quizRef.current = savedQuiz;
        setQuiz(savedQuiz);
      }
      // a finished item is already reported: the restore writes no second progress row
      reported.current = itemComplete(data, savedRun ?? newRun(0), savedQuiz ?? newQuiz(questions.length, 0));
      setRestored(true);
    })();
    return () => {
      alive = false;
      if (wrongTimer.current) clearTimeout(wrongTimer.current);
      try {
        sub?.remove?.();
        p.pause();
        p.remove();
      } catch (e) {
        console.warn('listen: could not release the player', e);
      }
      player.current = null;
    };
  }, [data, n, questions, runKey, quizKey]);

  // another tab (the screen stays mounted) pauses the recording
  useFocusEffect(
    useCallback(
      () => () => {
        player.current?.pause();
      },
      [],
    ),
  );

  const total = length > 0 ? length : data.durationSec;
  const play = () => {
    const p = player.current;
    if (!p) return;
    if (playing) {
      p.pause();
      setPlaying(false);
      return;
    }
    if (total > 0 && position >= total - 0.25) void p.seekTo(0);
    applyRate(p, rateRef.current);
    p.play();
    setPlaying(true);
  };
  const replay = () => {
    const p = player.current;
    if (!p) return;
    void p.seekTo(0);
    setPosition(0);
    p.play();
    setPlaying(true);
  };
  const chooseRate = (next: number) => {
    rateRef.current = next;
    setRate(next);
    if (player.current) applyRate(player.current, next);
    void saveResumeValue(getDb(), LISTENING_RATE_KEY, next);
  };

  // the bar: a tap or a drag seeks to (x / width) * total
  const [barWidth, setBarWidth] = useState(0);
  const fractionAt = (x: number) => Math.min(1, Math.max(0, barWidth > 0 ? x / barWidth : 0));
  const seekFraction = (f: number) => {
    if (total <= 0) return;
    void player.current?.seekTo(f * total);
    setPosition(f * total);
  };
  const shownFraction = dragFraction ?? (total > 0 ? Math.min(1, position / total) : 0);

  const order = rightOrder(n, run.seed);
  const complete = isComplete(run, pairs.length);

  // the first time every part of the item is finished: the progress row (an existing one stays as it is) and onFinished
  const finishIfComplete = (nextRun: MatchRun, nextQuiz: QuizRun) => {
    if (!itemComplete(data, nextRun, nextQuiz) || reported.current) return;
    reported.current = true;
    void (async () => {
      try {
        const db = getDb();
        const known = (await db.getGameProgress(LISTENING_PROGRESS_KEY)).some((r) => r.itemId === data.id && r.state === 'done');
        if (!known) await db.setGameProgress(LISTENING_PROGRESS_KEY, data.id, 'done', { mistakes: nextRun.mistakes, at: localDateString() });
      } catch (e) {
        console.warn('listen: could not write the progress', e);
      }
      onFinished();
    })();
  };

  const tryPair = (l: number, r: number) => {
    const { run: next, correct } = pick(run, l, r);
    setLeft(null);
    setRight(null);
    setRun(next);
    if (correct) {
      void saveResumeValue(getDb(), runKey, serializeRun(next));
      finishIfComplete(next, quiz);
    } else {
      setWrong({ left: l, right: r });
      if (wrongTimer.current) clearTimeout(wrongTimer.current);
      wrongTimer.current = setTimeout(() => setWrong(null), WRONG_MS);
    }
  };
  const tapLeft = (i: number) => {
    if (wrong || run.matched.includes(i)) return;
    setLeft(i);
    if (right !== null) tryPair(i, right);
  };
  const tapRight = (i: number) => {
    if (wrong || run.matched.includes(i)) return;
    setRight(i);
    if (left !== null) tryPair(left, i);
  };
  const again = () => {
    const next = newRun(freshSeed());
    setRun(next);
    setLeft(null);
    setRight(null);
    setWrong(null);
    void saveResumeValue(getDb(), runKey, serializeRun(next));
  };

  const answer = (qi: number, option: number) => {
    const base = quizRef.current;
    const next = answerQuiz(base, qi, option);
    if (next === base) return;
    quizRef.current = next;
    setQuiz(next);
    void saveResumeValue(getDb(), quizKey, serializeQuiz(next));
  };
  const check = () => {
    const next = checkQuiz(quizRef.current);
    if (next === quizRef.current) return;
    quizRef.current = next;
    setQuiz(next);
    void saveResumeValue(getDb(), quizKey, serializeQuiz(next));
    questions.forEach((q, i) => {
      if (next.answers[i] !== q.answer) return;
      awardXpThen('listening', `${data.id}:${q.id}`, (points) => {
        const cur = quizRef.current;
        if (cur.seed !== next.seed) return;
        const paid = { ...cur, earned: cur.earned + points };
        quizRef.current = paid;
        setQuiz(paid);
        void saveResumeValue(getDb(), quizKey, serializeQuiz(paid));
      });
    });
    finishIfComplete(run, next);
  };
  const quizAgain = () => {
    const next = newQuiz(questions.length, freshSeed());
    quizRef.current = next;
    setQuiz(next);
    void saveResumeValue(getDb(), quizKey, serializeQuiz(next));
  };

  const optionButton = (qi: number, k: number) => {
    const q = questions[qi];
    const chosen = quiz.answers[qi];
    const answered = quiz.checked;
    const picked = chosen === k;
    const right = k === q.answer;
    const edge = answered ? (right ? colors.success : picked ? colors.danger : colors.border) : picked ? colors.tint : colors.border;
    return (
      <Pressable
        key={`q${qi}-${k}`}
        testID={`speech-listen-q-${qi}-opt-${k}`}
        accessibilityRole="button"
        accessibilityState={{ disabled: answered, selected: picked }}
        onPress={() => answer(qi, k)}
        style={[styles.cell, themedEdgeStyle(g), { backgroundColor: colors.card, borderColor: edge }, (answered ? right || picked : picked) && styles.cellOn]}
      >
        <Text style={[styles.cellText, { color: answered ? (right ? colors.success : picked ? colors.danger : colors.text) : picked ? colors.tint : colors.text }]}>{q.options[k]}</Text>
      </Pressable>
    );
  };

  const cell = (side: 'left' | 'right', i: number, label: string) => {
    const done = run.matched.includes(i);
    const bad = wrong !== null && (side === 'left' ? wrong.left === i : wrong.right === i);
    const chosen = (side === 'left' ? left : right) === i;
    const edge = done ? colors.success : bad ? colors.danger : chosen ? colors.tint : colors.border;
    return (
      <Pressable
        key={`${side}-${i}`}
        testID={`speech-listen-${side}-${i}`}
        accessibilityRole="button"
        accessibilityState={{ selected: chosen, disabled: done }}
        onPress={() => (side === 'left' ? tapLeft(i) : tapRight(i))}
        style={[
          styles.cell,
          themedEdgeStyle(g),
          { backgroundColor: colors.card, borderColor: edge },
          (chosen || done || bad) && styles.cellOn,
        ]}
      >
        <Text
          style={[
            styles.cellText,
            {
              color: done ? colors.success : bad ? colors.danger : colors.text,
            },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <GameFrame
      testID="speech-listen-screen"
      target={target}
      currentCard={`speech-listen:${data.id}`}
      hideLevelCounter
      scrollToEndOnDock={false}
      top={
        <View style={styles.top}>
          <BackButton
            testID="speech-back"
            onPress={() => {
              player.current?.pause();
              onBack();
            }}
            pressStyle={styles.backPress}
            arrowStyle={[styles.backArrow, { color: colors.text }]}
          />
          <Text style={[styles.heading, { color: colors.text }]}>{listenTitle(data.id, sx)}</Text>
        </View>
      }
    >
      <View style={styles.box}>
        <XpChip flush />
        <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
          <Pressable
            testID="speech-listen-play"
            accessibilityRole="button"
            accessibilityLabel={playing ? sx.pause : sx.play}
            onPress={play}
            style={[styles.playBtn, themedEdgeStyle(g), { backgroundColor: colors.tint, borderColor: colors.border }]}
          >
            <Text style={[styles.playText, { color: colors.onTint }]}>{playing ? `⏸ ${sx.pause}` : `▶ ${sx.play}`}</Text>
          </Pressable>
          <View style={styles.times}>
            <Text testID="speech-listen-elapsed" style={[styles.time, { color: colors.textMuted }]}>
              {clock(dragFraction !== null ? dragFraction * total : position)}
            </Text>
            <Text testID="speech-listen-total" style={[styles.time, { color: colors.textMuted }]}>
              {clock(total)}
            </Text>
          </View>
          <View
            testID="speech-listen-bar"
            accessibilityLabel={sx.seekA11y}
            style={styles.barHit}
            onLayout={(e) => {
              setBarWidth(e.nativeEvent.layout.width);
            }}
            onTouchStart={(e) => setDragFraction(fractionAt(e.nativeEvent.locationX))}
            onTouchMove={(e) => setDragFraction(fractionAt(e.nativeEvent.locationX))}
            onTouchEnd={(e) => {
              seekFraction(fractionAt(e.nativeEvent.locationX));
              setDragFraction(null);
            }}
            onTouchCancel={() => setDragFraction(null)}
          >
            <View pointerEvents="none" style={[styles.barTrack, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.barFill,
                  {
                    backgroundColor: colors.tint,
                    width: `${shownFraction * 100}%`,
                  },
                ]}
              />
            </View>
          </View>
          <Pressable
            testID="speech-listen-replay"
            accessibilityRole="button"
            onPress={replay}
            style={[styles.replay, themedEdgeStyle(g), { borderColor: colors.border, backgroundColor: colors.card }]}
          >
            <Text style={[styles.chipText, { color: colors.text }]}>{`↺ ${sx.replay}`}</Text>
          </Pressable>
          <View style={styles.rates}>
            {RATES.map((r) => {
              const on = r === rate;
              return (
                <Pressable
                  key={r}
                  testID={`speech-listen-rate-${r}`}
                  accessibilityRole="button"
                  accessibilityLabel={sx.speedA11y(`${r}x`)}
                  accessibilityState={{ selected: on }}
                  onPress={() => chooseRate(r)}
                  style={[
                    styles.rate,
                    themedEdgeStyle(g),
                    {
                      backgroundColor: on ? colors.tint : colors.card,
                      borderColor: on ? colors.tint : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: on ? colors.onTint : colors.text }]}>{`${r}x`}</Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {restored && n > 0 && (
          <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
            <Text style={[styles.matchTitle, { color: colors.text }]}>{sx.matchTitle}</Text>
            <Text style={[styles.instruction, { color: colors.textMuted }]}>{target === 'en' ? sx.matchInstructionEn : sx.matchInstruction}</Text>
            <View style={styles.columns}>
              <View style={styles.column}>{pairs.map((p, i) => cell('left', i, p.place))}</View>
              <View style={styles.column}>{order.map((i) => cell('right', i, pairs[i].greeting))}</View>
            </View>
            {complete && (
              <View style={styles.result}>
                <Text testID="speech-listen-result" style={[styles.resultText, { color: colors.success }]}>
                  {sx.matchResult(run.mistakes)}
                </Text>
                <Pressable
                  testID="speech-listen-again"
                  accessibilityRole="button"
                  onPress={again}
                  style={[
                    styles.replay,
                    themedEdgeStyle(g),
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.card,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: colors.text }]}>{sx.tryAgain}</Text>
                </Pressable>
              </View>
            )}
          </Card>
        )}

        {restored && questions.length > 0 && (
          <View testID="speech-listen-quiz">
          <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
            <Text style={[styles.matchTitle, { color: colors.text }]}>{sx.quizTitle}</Text>
            <Text style={[styles.instruction, { color: colors.textMuted }]}>{sx.quizInstruction}</Text>
            {questions.map((q, qi) => (
              <View key={q.id} style={styles.question}>
                <Text testID={`speech-listen-q-${qi}`} style={[styles.cellText, { color: colors.text }]}>{`${qi + 1}. ${q.q}`}</Text>
                {optionOrder(qi, q.options.length, quiz.seed).map((k) => optionButton(qi, k))}
              </View>
            ))}
            {!quiz.checked && (
              <View style={styles.result}>
                <Text testID="speech-listen-quiz-marked" style={[styles.instruction, { color: colors.textMuted }]}>{sx.quizMarked(quiz.answers.filter((a) => a >= 0).length, questions.length)}</Text>
                <Pressable
                  testID="speech-listen-quiz-check"
                  accessibilityRole="button"
                  disabled={!quizAllMarked(quiz)}
                  onPress={check}
                  style={[styles.replay, themedEdgeStyle(g), { borderColor: colors.border, backgroundColor: colors.card, opacity: quizAllMarked(quiz) ? 1 : 0.5 }]}
                >
                  <Text style={[styles.chipText, { color: colors.text }]}>{sx.quizCheck}</Text>
                </Pressable>
              </View>
            )}
            {quizComplete(quiz) && (
              <View style={styles.result}>
                <Text testID="speech-listen-quiz-result" style={[styles.resultText, { color: colors.success }]}>
                  {sx.quizResult(quizRight(quiz, questions), questions.length)}
                </Text>
                {quiz.earned > 0 && (
                  <Text testID="speech-listen-quiz-xp" style={[styles.resultText, { color: colors.success }]}>
                    {sx.quizXp(quiz.earned)}
                  </Text>
                )}
                <Pressable
                  testID="speech-listen-quiz-again"
                  accessibilityRole="button"
                  onPress={quizAgain}
                  style={[styles.replay, themedEdgeStyle(g), { borderColor: colors.border, backgroundColor: colors.card }]}
                >
                  <Text style={[styles.chipText, { color: colors.text }]}>{sx.tryAgain}</Text>
                </Pressable>
              </View>
            )}
          </Card>
          </View>
        )}
      </View>
    </GameFrame>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  backPress: {
    minHeight: tapTarget,
    minWidth: tapTarget,
    justifyContent: 'center',
  },
  backArrow: { fontSize: fontSize.xxl },
  heading: { flex: 1, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  box: { marginHorizontal: spacing.xl, gap: spacing.md },
  card: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  brutalCard: { padding: spacing.lg, gap: spacing.md },
  playBtn: {
    minHeight: tapTarget * 1.5,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playText: { fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  time: { fontSize: fontSize.sm },
  barHit: { minHeight: tapTarget, justifyContent: 'center' },
  barTrack: {
    height: spacing.md,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  barFill: { height: '100%' },
  replay: {
    minHeight: tapTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  rates: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  rate: {
    minHeight: tapTarget,
    minWidth: tapTarget,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  chipText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  matchTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  instruction: { fontSize: fontSize.sm },
  columns: { flexDirection: 'row', gap: spacing.md },
  column: { flex: 1, gap: spacing.sm },
  // one question with its options, stacked in the questions card (no flex: the card has no fixed height)
  question: { gap: spacing.sm },
  cell: {
    minHeight: tapTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
  },
  cellOn: { borderWidth: 2 },
  cellText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  result: { gap: spacing.md },
  resultText: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
});
