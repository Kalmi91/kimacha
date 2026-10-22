import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Text } from '@/components/KText';
import Colors from '@/constants/Colors';
import { fontSize, fontWeight, motion, radius, spacing, tapTarget } from '@/constants/Theme';
import { themedEdgeStyle } from '@/components/grammar/Themed';
import GameFrame, { GameEmpty } from '@/components/practice/GameFrame';
import { t } from '@/lib/i18n';
import { countLearningToday } from '@/lib/learningDay';
import { useGrammarColors } from '@/lib/grammarColors';
import { creditRight } from '@/lib/practice/gameRound';
import {
  MATCH_MODE,
  MATCH_ROUND_MS,
  boardColumns,
  currentBoard,
  loadMatchBest,
  matchCard,
  matchLogic,
  matchTotal,
  recordMatchTime,
  tickMatch,
  tryPair,
  usedMs,
} from '@/lib/practice/match';
import { useGameRound } from '@/lib/practice/useGameRound';
import { useLoadOnMount } from '@/lib/useLoadOnMount';
import { useTheme } from '@/lib/ThemeContext';

// Quick match (beta practiceMatch, PLAN-jatekok-1021 BRIEF-A3): Spanish words on the left, English on the right, tap one of
// each. 3 tables of 5 pairs and 60 seconds for the whole round (the bar on top). A pair gets a green flash and is gone; a wrong
// one a red flash and a mark on both words. A pair found with no miss is one half. The time left is saved with the round
// (the clock runs only while this screen is shown), the best time of a complete round is kept. Round, saving and the shell
// are the shared ones (see DictationGame.tsx).

const TICK_MS = 250;
// A longer gap between two ticks (the app was in the background) is not counted.
const MAX_STEP_MS = TICK_MS * 2;
const FLASH_MS = motion.feedback;

type Side = 'es' | 'en';
interface Flash {
  es: string;
  en: string;
  ok: boolean;
}

const seconds = (ms: number) => Math.ceil(ms / 1000);

export default function MatchGame() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t();
  const game = useGameRound(matchLogic);
  const { update } = game;
  const [selected, setSelected] = useState<{ side: Side; id: string } | null>(null);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [best, setBest] = useState<number | null>(null);
  // Bumps after every credited answer: the level counter reads the due words again.
  const [creditSeq, setCreditSeq] = useState(0);
  const [focused, setFocused] = useState(true);

  const { round, target } = game;
  const state = round?.state;
  const running = focused && !!state && state.over === null;

  // The clock runs while the round is on screen; leaving (tab, mode, app closed) saves the time left.
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  useEffect(() => {
    if (!running) return;
    let last = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      const step = Math.min(now - last, MAX_STEP_MS);
      last = now;
      update((prev) => tickMatch(prev, step), false);
    }, TICK_MS);
    return () => {
      clearInterval(timer);
      update((prev) => prev, true);
    };
  }, [running, update]);
  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), FLASH_MS);
    return () => clearTimeout(timer);
  }, [flash]);
  const loadBest = useCallback(async () => {
    setBest(await loadMatchBest());
  }, []);
  useLoadOnMount(loadBest);

  if (!game.loaded) return null;
  if (!round || !state) return <GameEmpty mode={MATCH_MODE} target={target} />;

  const total = matchTotal(state);
  const board = currentBoard(state);
  const cardOf = (id: string) => matchCard(round.items.find((i) => i.id === id)!);

  if (state.over || board < 0) {
    const allFound = state.over === 'all';
    return (
      <GameFrame
        testID="match-screen"
        target={target}
        currentCard="practice-match"
        creditSeq={creditSeq}
        centered
        dock={{ testID: 'match-again', label: s.practiceTab.game.newRound, tone: 'next', onPress: game.newRound }}
      >
        <Text testID="match-done" variant="title" style={[styles.doneTitle, { color: colors.text }]}>
          {allFound ? s.practiceTab.match.allFound : s.practiceTab.match.timeUp}
        </Text>
        <Text testID="match-result" style={[styles.result, { color: colors.text }]}>
          {s.practiceTab.match.result(state.found.length, total, seconds(usedMs(state)))}
        </Text>
        {best !== null && (
          <Text testID="match-best" style={[styles.best, { color: colors.textMuted }]}>{s.practiceTab.match.best(seconds(best))}</Text>
        )}
      </GameFrame>
    );
  }

  const tap = (side: Side, id: string) => {
    if (!selected || selected.side === side) {
      setSelected({ side, id });
      return;
    }
    const esId = side === 'es' ? id : selected.id;
    const enId = side === 'en' ? id : selected.id;
    const result = tryPair(state, esId, enId);
    setSelected(null);
    if (result.hit === null) return;
    setFlash({ es: esId, en: enId, ok: result.hit });
    // the state is saved first: a round that is left and resumed never credits a pair twice
    update((prev) => tryPair(prev, esId, enId).state);
    void (async () => {
      try {
        if (result.hit && result.firstTry) await creditRight(esId);
        else await countLearningToday();
        if (result.state.over === 'all') setBest(await recordMatchTime(usedMs(result.state)));
      } catch {
        // the round goes on; only this credit is lost
      }
      setCreditSeq((n) => n + 1);
    })();
  };

  const columns = boardColumns(state.boards[board]);
  const column = (side: Side) =>
    columns[side].map((id, index) => {
      const gone = state.found.includes(id);
      const flashed = flash && flash[side] === id ? flash : null;
      if (gone && !flashed?.ok) return <View key={id} style={styles.cardGap} />;
      const picked = selected?.side === side && selected.id === id;
      const text = cardOf(id)[side];
      const fill = flashed ? (flashed.ok ? colors.successFill : colors.danger) : picked ? colors.tint : colors.card;
      const ink = flashed ? (flashed.ok ? colors.text : colors.onTint) : picked ? colors.onTint : colors.text;
      return (
        <Pressable
          key={id}
          testID={`match-${side}-${index}`}
          accessibilityRole="button"
          accessibilityLabel={text}
          accessibilityState={{ selected: picked }}
          onPress={() => tap(side, id)}
          style={[styles.card, themedEdgeStyle(g), { backgroundColor: fill, borderColor: picked || flashed ? fill : colors.border }]}
        >
          <Text numberOfLines={2} style={[styles.cardText, { color: ink }]}>
            {state.missed.includes(id) && !gone ? `✗ ${text}` : text}
          </Text>
        </Pressable>
      );
    });

  const left = seconds(state.leftMs);
  return (
    <GameFrame
      testID="match-screen"
      target={target}
      currentCard={`practice-match:${state.boards[board].join(',')}`}
      creditSeq={creditSeq}
      progress={{ text: s.practiceTab.progress(board + 1, state.boards.length), label: s.practiceTab.match.boardLabel(board + 1, state.boards.length) }}
    >
      <View
        testID="match-timer"
        accessibilityRole="timer"
        accessibilityLabel={s.practiceTab.match.timeLeft(left)}
        accessibilityValue={{ min: 0, max: seconds(MATCH_ROUND_MS), now: left }}
        style={styles.timer}
      >
        <View style={[styles.track, { backgroundColor: colors.border }]}>
          <View style={[styles.fill, { backgroundColor: left <= 10 ? colors.danger : colors.tint, width: `${(state.leftMs / MATCH_ROUND_MS) * 100}%` }]} />
        </View>
        <Text style={[styles.timerText, { color: colors.textMuted }]}>{left}</Text>
      </View>
      <View style={styles.columns}>
        <View style={styles.column}>{column('es')}</View>
        <View style={styles.column}>{column('en')}</View>
      </View>
    </GameFrame>
  );
}

const styles = StyleSheet.create({
  timer: { marginHorizontal: spacing.xl, marginBottom: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  track: { flex: 1, height: spacing.md, borderRadius: radius.full, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.full },
  timerText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, minWidth: spacing.xl },
  columns: { marginHorizontal: spacing.xl, flexDirection: 'row', gap: spacing.md },
  column: { flex: 1, gap: spacing.sm },
  card: { minHeight: tapTarget + spacing.md, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, justifyContent: 'center' },
  cardGap: { minHeight: tapTarget + spacing.md },
  cardText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, textAlign: 'center' },
  doneTitle: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, textAlign: 'center' },
  result: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, textAlign: 'center' },
  best: { fontSize: fontSize.md, textAlign: 'center' },
});
