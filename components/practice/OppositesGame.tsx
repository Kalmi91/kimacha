import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/KText';
import Colors from '@/constants/Colors';
import { fontSize, fontWeight, radius, spacing, tapTarget } from '@/constants/Theme';
import { Card } from '@/components/grammar/Brutal';
import { themedEdgeStyle } from '@/components/grammar/Themed';
import GameFrame, { GameEmpty, GameSummary } from '@/components/practice/GameFrame';
import ResultBadge from '@/components/ResultBadge';
import SpeakButton from '@/components/SpeakButton';
import { findPcicItem } from '@/data/pcic';
import { t } from '@/lib/i18n';
import { speechLang } from '@/lib/languages';
import { useGrammarColors } from '@/lib/grammarColors';
import { creditRight, creditWrong } from '@/lib/practice/gameRound';
import {
  OPPOSITES_MODE,
  currentWordId,
  nextOpposites,
  oppositeText,
  oppositesDone,
  oppositesLogic,
  oppositesPosition,
  oppositesScore,
  pickOption,
} from '@/lib/practice/opposites';
import { useGameRound } from '@/lib/practice/useGameRound';
import { speak, stopSpeaking } from '@/lib/speech';
import { useTheme } from '@/lib/ThemeContext';
import { useSingleFlight } from '@/lib/useSingleFlight';

// Opposites (beta practiceOpposites, PLAN-jatekok-1021 BRIEF-A4b): the word (with its article) is shown and read aloud, "What is
// the opposite?", four words to tap. A right one is one half for the asked word; a wrong one shows the right one, only the day
// counts and the word is never sent back a step. Round, saving and summary are the shared ones (see DictationGame.tsx).

export default function OppositesGame() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t();
  const game = useGameRound(oppositesLogic);
  const runOnce = useSingleFlight();
  // Bumps after every credited answer: the level counter reads the due words again.
  const [creditSeq, setCreditSeq] = useState(0);

  const { round, target } = game;
  const state = round?.state;
  const headId = state ? currentWordId(state) : undefined;
  const item = round && headId ? round.items.find((i) => i.id === headId) : undefined;
  const question = state && headId ? state.questions[headId] : undefined;
  const word = item ? oppositeText(item) : '';
  const picked = state?.picked ?? null;
  const turn = state?.turn ?? 0;

  // The word is read aloud when it comes up; not after the answer, and not when a resumed round opens on the result.
  const autoSay = word && picked === null ? word : null;
  useEffect(() => {
    if (autoSay) speak(autoSay, speechLang(target));
  }, [autoSay, turn, target]);

  if (!game.loaded) return null;
  if (!round || !state) return <GameEmpty mode={OPPOSITES_MODE} target={target} text={s.practiceTab.opposites.empty} />;
  if (oppositesDone(state) || !item || !question) {
    return (
      <GameSummary
        mode={OPPOSITES_MODE}
        target={target}
        score={oppositesScore(state)}
        total={round.items.length}
        creditSeq={creditSeq}
        onNewRound={game.newRound}
      />
    );
  }

  const say = () => {
    stopSpeaking();
    speak(word, speechLang(target));
  };
  const choose = (option: string) => {
    void runOnce(async () => {
      const { state: next, hit } = pickOption(state, option);
      if (hit === null) return;
      // the answer is saved first: a round that is left and resumed shows the result and never credits twice
      game.update(next);
      try {
        if (hit) await creditRight(item.id);
        else await creditWrong(item.id, false);
      } catch {
        // the round goes on; only this credit is lost
      }
      setCreditSeq((n) => n + 1);
    });
  };
  const next = () => {
    stopSpeaking();
    game.update(nextOpposites(state));
  };

  const answered = picked !== null;
  const answerText = oppositeText(findPcicItem(question.answer)!);
  const position = oppositesPosition(state, round.items.length);
  return (
    <GameFrame
      testID="opposites-screen"
      target={target}
      currentCard={`practice-opposites:${item.id}`}
      creditSeq={creditSeq}
      progress={{ text: s.practiceTab.progress(position, round.items.length), label: s.practiceTab.game.progressLabel(position, round.items.length) }}
      dock={answered ? { testID: 'opposites-next', label: `${s.card.next} →`, tone: 'next', onPress: next } : undefined}
    >
      <View style={styles.box}>
        <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
          <Text style={[styles.prompt, { color: colors.textMuted }]}>{s.practiceTab.opposites.prompt}</Text>
          <Text testID="opposites-word" style={[styles.word, { color: colors.text }]}>{word}</Text>
          <SpeakButton
            testID="opposites-speak"
            accessibilityLabel={s.practiceTab.opposites.listen}
            onPress={say}
            style={styles.speakBtn}
            iconStyle={styles.speakIcon}
          />
        </Card>
        <View style={styles.options}>
          {question.options.map((id, i) => {
            const label = oppositeText(findPcicItem(id)!);
            const isAnswer = id === question.answer;
            const isWrongPick = answered && id === picked && !isAnswer;
            const fill = answered && isAnswer ? colors.successFill : isWrongPick ? colors.danger : colors.card;
            const ink = isWrongPick ? colors.onTint : colors.text;
            return (
              <Pressable
                key={id}
                testID={`opposites-option-${i}`}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected: id === picked, disabled: answered }}
                onPress={() => choose(id)}
                style={[styles.option, themedEdgeStyle(g), { backgroundColor: fill, borderColor: answered && (isAnswer || isWrongPick) ? fill : colors.border }]}
              >
                <Text style={[styles.optionText, { color: ink }]}>{answered && isAnswer ? `✓ ${label}` : isWrongPick ? `✗ ${label}` : label}</Text>
              </Pressable>
            );
          })}
        </View>
        {answered && (
          <View style={styles.feedback}>
            <ResultBadge testID="opposites-result" correct={picked === question.answer} label={picked === question.answer ? s.card.correct : s.card.wrong} align="center" />
            {picked !== question.answer && (
              <Text testID="opposites-answer" style={[styles.answer, { color: colors.text }]}>{s.practiceTab.opposites.answer(answerText)}</Text>
            )}
          </View>
        )}
      </View>
    </GameFrame>
  );
}

const styles = StyleSheet.create({
  box: { marginHorizontal: spacing.xl, gap: spacing.lg },
  card: { borderRadius: radius.lg, padding: spacing.xl, gap: spacing.md, alignItems: 'center' },
  brutalCard: { padding: spacing.xl, gap: spacing.md, alignItems: 'center' },
  prompt: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, textAlign: 'center' },
  word: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, textAlign: 'center' },
  speakBtn: { minHeight: tapTarget, minWidth: tapTarget, alignItems: 'center', justifyContent: 'center' },
  speakIcon: { fontSize: fontSize.xl },
  options: { gap: spacing.sm },
  option: { minHeight: tapTarget + spacing.md, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, justifyContent: 'center' },
  optionText: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, textAlign: 'center' },
  feedback: { alignItems: 'center', gap: spacing.sm },
  answer: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, textAlign: 'center' },
});
