import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text } from '@/components/KText';
import Colors from '@/constants/Colors';
import { fontSize, fontWeight, radius, spacing, tapTarget } from '@/constants/Theme';
import { Card } from '@/components/grammar/Brutal';
import { themedEdgeStyle } from '@/components/grammar/Themed';
import GameFrame, { GameEmpty, GameSummary } from '@/components/practice/GameFrame';
import ResultBadge from '@/components/ResultBadge';
import SpeakButton from '@/components/SpeakButton';
import { t } from '@/lib/i18n';
import { speechLang } from '@/lib/languages';
import { useGrammarColors } from '@/lib/grammarColors';
import { creditRight } from '@/lib/practice/gameRound';
import { useGameRound } from '@/lib/practice/useGameRound';
import { countLearningToday } from '@/lib/learningDay';
import {
  SCRAMBLE_MODE,
  cellsPerRow,
  currentWordId,
  nextScramble,
  scrambleDone,
  scramblePosition,
  scrambleLogic,
  scrambleScore,
  scrambleTiles,
  scrambleWord,
  seedOf,
  skipScramble,
  splitRows,
  tapTile,
  type ScrambleOutcome,
} from '@/lib/practice/scramble';
import { speak, stopSpeaking } from '@/lib/speech';
import { useTheme } from '@/lib/ThemeContext';

// Letter scramble (beta practiceScramble, PLAN-jatekok-1021 BRIEF-A2): the meaning on top, empty places for the letters of the
// word (a Spanish noun's article stands before them as fixed text), the shuffled letters below; tap them in order. A right
// letter jumps into its place, a wrong one shakes and counts a mistake. Done with 0 mistakes = one half; Skip shows the
// solution. The word is read aloud when it is done. Round, saving and summary are the shared ones (see DictationGame.tsx).

const SHAKE_MS = 60;
// The row width the places and the tiles can use: the screen minus the box margin, the card padding and a slack for the card border / shadow.
const SIDE_SPACE = 2 * (spacing.xl + spacing.xl) + spacing.lg;

function Tile({ letter, index, shakeSeq, onPress }: { letter: string; index: number; shakeSeq: number; onPress: () => void }) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const [x] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (shakeSeq === 0) return;
    Animated.sequence([
      Animated.timing(x, { toValue: spacing.sm, duration: SHAKE_MS, useNativeDriver: true }),
      Animated.timing(x, { toValue: -spacing.sm, duration: SHAKE_MS, useNativeDriver: true }),
      Animated.timing(x, { toValue: spacing.xs, duration: SHAKE_MS, useNativeDriver: true }),
      Animated.timing(x, { toValue: 0, duration: SHAKE_MS, useNativeDriver: true }),
    ]).start();
  }, [shakeSeq, x]);
  return (
    <Animated.View style={{ transform: [{ translateX: x }] }}>
      <Pressable
        testID={`scramble-letter-${index}`}
        accessibilityRole="button"
        accessibilityLabel={letter}
        onPress={onPress}
        style={[styles.tile, themedEdgeStyle(g), { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <Text style={[styles.tileText, { color: colors.text }]}>{letter}</Text>
      </Pressable>
    </Animated.View>
  );
}

export default function ScrambleGame() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t();
  const game = useGameRound(scrambleLogic);
  const { width: screenWidth } = useWindowDimensions();
  // The last wrong tile and a counter, so the same tile shakes again on the next mistake.
  const [shake, setShake] = useState({ tile: -1, seq: 0 });
  // Bumps after every credited answer: the level counter reads the due words again.
  const [creditSeq, setCreditSeq] = useState(0);

  const { round, target } = game;
  const state = round?.state;
  const headId = state ? currentWordId(state) : undefined;
  const item = round && headId ? round.items.find((i) => i.id === headId) : undefined;
  const word = item ? scrambleWord(item, target) : null;

  if (!game.loaded) return null;
  if (!round || !state) return <GameEmpty mode={SCRAMBLE_MODE} target={target} />;
  if (scrambleDone(state) || !item || !word) {
    return (
      <GameSummary
        mode={SCRAMBLE_MODE}
        target={target}
        score={scrambleScore(state)}
        total={round.items.length}
        creditSeq={creditSeq}
        onNewRound={game.newRound}
      />
    );
  }

  const tiles = scrambleTiles(word.letters, seedOf(item.id));
  // Balanced rows over the whole tile list (a used tile leaves its gap), so a single tile is never left alone in the last row.
  const tileRows = splitRows(tiles.map((_, i) => i), cellsPerRow(screenWidth - SIDE_SPACE, tapTarget, spacing.sm));
  // The same for the places of a single word (the article counts as one cell, -1); a phrase with spaces wraps as before.
  const wholeWord = word.chars.every((c) => c.slot !== null);
  const placeRows = splitRows(
    [...(word.article !== '' ? [-1] : []), ...word.chars.map((_, i) => i)],
    cellsPerRow(screenWidth - SIDE_SPACE, tapTarget, spacing.xs),
  );
  const solved = state.finished === 'skipped';
  const say = () => {
    stopSpeaking();
    speak(word.say, speechLang(target));
  };
  // The word is done: read it aloud, and credit it (a clean word is one half; one with mistakes only counts the day).
  const finish = (outcome: ScrambleOutcome) => {
    say();
    if (outcome === 'skipped') return;
    void (async () => {
      try {
        if (outcome === 'clean') await creditRight(item.id);
        else await countLearningToday();
      } catch {
        // the round goes on; only this credit is lost
      }
      setCreditSeq((n) => n + 1);
    })();
  };
  const tap = (index: number) => {
    const { state: next, hit } = tapTile(state, word.letters, tiles, index);
    if (hit === null) return;
    if (hit === false) setShake((prev) => ({ tile: index, seq: prev.seq + 1 }));
    // the state is saved first: a round that is left and resumed shows the finished word and never credits twice
    game.update(next);
    if (next.finished) finish(next.finished);
  };
  const skip = () => {
    game.update(skipScramble(state));
    finish('skipped');
  };
  const next = () => {
    stopSpeaking();
    game.update(nextScramble(state));
  };

  const article = word.article !== '' && <Text testID="scramble-article" style={[styles.article, { color: colors.textMuted }]}>{word.article}</Text>;
  const place = (c: (typeof word.chars)[number], i: number) => {
    if (c.slot === null) {
      return c.ch.trim() === '' ? <View key={i} style={styles.gap} /> : <Text key={i} style={[styles.article, { color: colors.textMuted }]}>{c.ch}</Text>;
    }
    const filled = c.slot < state.used.length || solved;
    return (
      <View
        key={i}
        testID={`scramble-slot-${c.slot}`}
        accessibilityLabel={filled ? c.ch : s.practiceTab.scramble.emptySlot}
        style={[
          styles.slot,
          themedEdgeStyle(g),
          { borderColor: filled ? (solved ? colors.danger : colors.successFill) : colors.tabIconDefault },
        ]}
      >
        <Text style={[styles.slotText, { color: colors.text }]}>{filled ? c.ch : ''}</Text>
      </View>
    );
  };

  const position = scramblePosition(state, round.items.length);
  return (
    <GameFrame
      testID="scramble-screen"
      target={target}
      currentCard={`practice-scramble:${item.id}`}
      creditSeq={creditSeq}
      progress={{ text: s.practiceTab.progress(position, round.items.length), label: s.practiceTab.game.progressLabel(position, round.items.length) }}
      dock={state.finished ? { testID: 'scramble-next', label: `${s.card.next} →`, tone: 'next', onPress: next } : undefined}
    >
      <View style={styles.box}>
        <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
          <Text testID="scramble-meaning" style={[styles.meaning, { color: colors.text }]}>{word.meaning}</Text>
          {wholeWord ? (
            <View testID="scramble-places" style={styles.placeRows}>
              {placeRows.map((row, r) => (
                <View key={r} style={styles.places}>
                  {row.map((i) => (i === -1 ? <View key={i}>{article}</View> : place(word.chars[i], i)))}
                </View>
              ))}
            </View>
          ) : (
            <View testID="scramble-places" style={styles.places}>
              {article}
              {word.chars.map(place)}
            </View>
          )}
          {!state.finished && (
            <View testID="scramble-tiles" style={styles.tileRows}>
              {tileRows.map((row, r) => (
                <View key={r} style={styles.tiles}>
                  {row.map((i) =>
                    state.used.includes(i) ? (
                      <View key={i} style={styles.tileGap} />
                    ) : (
                      <Tile key={i} letter={tiles[i]} index={i} shakeSeq={shake.tile === i ? shake.seq : 0} onPress={() => tap(i)} />
                    ),
                  )}
                </View>
              ))}
            </View>
          )}
          <Text testID="scramble-mistakes" style={[styles.mistakes, { color: colors.textMuted }]}>{s.practiceTab.scramble.mistakes(state.mistakes)}</Text>
          {!state.finished && (
            <Pressable testID="scramble-skip" accessibilityRole="button" onPress={skip} style={styles.link}>
              <Text style={[styles.linkText, { color: colors.tint }]}>{s.practiceTab.scramble.skip}</Text>
            </Pressable>
          )}
          {state.finished && (
            <View style={styles.feedback}>
              {state.finished === 'clean' && <ResultBadge testID="scramble-result" correct label={s.card.correct} align="center" />}
              {state.finished === 'flawed' && <Text testID="scramble-result" style={[styles.note, { color: colors.text }]}>{s.practiceTab.scramble.noHalf(state.mistakes)}</Text>}
              {state.finished === 'skipped' && <Text testID="scramble-result" style={[styles.note, { color: colors.text }]}>{s.practiceTab.scramble.solution}</Text>}
              <SpeakButton
                testID="scramble-speak"
                accessibilityLabel={s.practiceTab.scramble.listen}
                onPress={say}
                style={styles.speakBtn}
                iconStyle={styles.speakIcon}
              />
            </View>
          )}
        </Card>
      </View>
    </GameFrame>
  );
}

const styles = StyleSheet.create({
  box: { marginHorizontal: spacing.xl },
  card: { borderRadius: radius.lg, padding: spacing.xl, gap: spacing.lg, alignItems: 'center' },
  brutalCard: { padding: spacing.xl, gap: spacing.lg, alignItems: 'center' },
  meaning: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, textAlign: 'center' },
  placeRows: { alignItems: 'center', gap: spacing.xs },
  places: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  article: { fontSize: fontSize.xl, fontWeight: fontWeight.semibold, marginRight: spacing.xs },
  gap: { width: spacing.md },
  slot: { minWidth: tapTarget, height: tapTarget, borderRadius: radius.sm, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  slotText: { fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  tileRows: { alignItems: 'center', gap: spacing.sm },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  tile: { minWidth: tapTarget, height: tapTarget, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tileGap: { minWidth: tapTarget, height: tapTarget },
  tileText: { fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  mistakes: { fontSize: fontSize.sm },
  link: { minHeight: tapTarget, justifyContent: 'center', paddingHorizontal: spacing.lg },
  linkText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  feedback: { alignItems: 'center', gap: spacing.sm },
  note: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, textAlign: 'center' },
  speakBtn: { minHeight: tapTarget, minWidth: tapTarget, alignItems: 'center', justifyContent: 'center' },
  speakIcon: { fontSize: fontSize.xl },
});
