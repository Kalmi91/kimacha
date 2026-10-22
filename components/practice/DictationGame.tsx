import { useEffect, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '@/components/KText';
import Colors from '@/constants/Colors';
import { fontSize, fontWeight, radius, spacing, tapTarget } from '@/constants/Theme';
import { BrutalBox, Card } from '@/components/grammar/Brutal';
import { themedInputStyle } from '@/components/grammar/Themed';
import GameFrame, { GameEmpty, GameSummary } from '@/components/practice/GameFrame';
import ResultBadge from '@/components/ResultBadge';
import { t } from '@/lib/i18n';
import { speechLang } from '@/lib/languages';
import { useGrammarColors } from '@/lib/grammarColors';
import { answerInputProps } from '@/lib/inputProps';
import {
  checkDictation,
  currentWordId,
  dictationDone,
  dictationLogic,
  dictationPosition,
  dictationScore,
  dictationWord,
  DICTATION_MODE,
  isDictationRight,
  nextDictation,
} from '@/lib/practice/dictation';
import { creditRight, creditWrong } from '@/lib/practice/gameRound';
import { useGameRound } from '@/lib/practice/useGameRound';
import { speak, stopSpeaking } from '@/lib/speech';
import { useSingleFlight } from '@/lib/useSingleFlight';
import { useTheme } from '@/lib/ThemeContext';

// Dictation (beta practiceDictation, PLAN-jatekok-1021 BRIEF-A1): the word is read aloud with its article, the learner types
// it. Right = 1 half, wrong = the correct form is shown and the word comes once more at the end of the round; two wrong
// typings in a row on a word are one step back (lib/practice/dictation.ts). The round, its saving and the summary are the
// shared ones (lib/practice/useGameRound.ts, components/practice/GameFrame.tsx).
// This file is the example of a game screen for components/practice/modes.ts.

export default function DictationGame() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t();
  const game = useGameRound(dictationLogic);
  const runOnce = useSingleFlight();
  const [typed, setTyped] = useState('');
  // Bumps after every credited answer: the level counter reads the due words again.
  const [creditSeq, setCreditSeq] = useState(0);

  const { round, target, strictAccents } = game;
  const state = round?.state;
  const headId = state ? currentWordId(state) : undefined;
  const item = round && headId ? round.items.find((i) => i.id === headId) : undefined;
  const word = item ? dictationWord(item, target) : null;
  const checked = state?.checked ?? null;
  const turn = state?.turn ?? 0;

  // The word is read aloud when it comes up, and again when it comes back (a new turn); not after the check, and not
  // when a resumed round opens on the feedback.
  const autoSay = word && !checked ? word.say : null;
  useEffect(() => {
    if (autoSay) speak(autoSay, speechLang(target));
  }, [autoSay, turn, target]);

  if (!game.loaded) return null;
  if (!round || !state) return <GameEmpty mode={DICTATION_MODE} target={target} />;
  if (dictationDone(state) || !item || !word) {
    return (
      <GameSummary
        mode={DICTATION_MODE}
        target={target}
        score={dictationScore(state)}
        total={round.items.length}
        creditSeq={creditSeq}
        onNewRound={game.newRound}
      />
    );
  }

  const play = () => {
    stopSpeaking();
    speak(word.say, speechLang(target));
  };
  const check = () => {
    void runOnce(async () => {
      const text = typed.trim();
      if (state.checked || !text) return;
      Keyboard.dismiss();
      const right = isDictationRight(text, word.answer, strictAccents);
      // the verdict is saved first: a round that is left and resumed shows it again and never credits twice
      game.update(checkDictation(state, text, right));
      try {
        if (right) await creditRight(item.id);
        else await creditWrong(item.id, true);
      } catch {
        // the round goes on; only this credit is lost
      }
      setCreditSeq((n) => n + 1);
    });
  };
  const next = () => {
    stopSpeaking();
    setTyped('');
    game.update(nextDictation(state));
  };

  const position = dictationPosition(state, round.items.length);
  const speakLabel = s.practiceTab.dictation.listen;
  return (
    <GameFrame
      testID="dictation-screen"
      target={target}
      currentCard={`practice-dictation:${item.id}`}
      creditSeq={creditSeq}
      progress={{ text: s.practiceTab.progress(position, round.items.length), label: s.practiceTab.game.progressLabel(position, round.items.length) }}
      dock={
        checked
          ? { testID: 'dictation-next', label: `${s.card.next} →`, tone: 'next', onPress: next }
          : { testID: 'dictation-check', label: `✓ ${s.card.check}`, tone: 'check', onPress: check, disabled: !typed.trim() }
      }
    >
      <View style={styles.box}>
        <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
          {g.brutal ? (
            <BrutalBox testID="dictation-speak" accessibilityLabel={speakLabel} onPress={play} style={styles.bigBrutal} boxStyle={styles.bigBrutalBox}>
              <Text style={styles.bigIcon}>🔊</Text>
            </BrutalBox>
          ) : (
            <Pressable
              testID="dictation-speak"
              accessibilityRole="button"
              accessibilityLabel={speakLabel}
              onPress={play}
              style={[styles.big, { backgroundColor: colors.tint }]}
            >
              <Text style={styles.bigIcon}>🔊</Text>
            </Pressable>
          )}
          <Pressable testID="dictation-replay" accessibilityRole="button" onPress={play} style={styles.link}>
            <Text style={[styles.linkText, { color: colors.tint }]}>{s.practiceTab.dictation.listenAgain}</Text>
          </Pressable>
          <TextInput
            key={turn}
            testID="dictation-input"
            style={[
              styles.input,
              { color: colors.text, borderColor: checked ? (checked.right ? colors.successFill : colors.danger) : colors.tabIconDefault },
              themedInputStyle(g),
              g.brutal && checked && { borderColor: checked.right ? colors.successFill : colors.danger },
            ]}
            placeholder={s.card.typeIn(target)}
            placeholderTextColor={colors.tabIconDefault}
            value={checked ? checked.typed : typed}
            onChangeText={setTyped}
            onSubmitEditing={checked ? next : check}
            editable={!checked}
            autoFocus
            {...answerInputProps}
          />
          {checked && (
            <View style={styles.feedback}>
              <ResultBadge testID="dictation-result" correct={checked.right} label={checked.right ? s.card.correct : s.card.wrong} align="center" />
              <Text testID="dictation-answer" style={[styles.answer, { color: colors.text }]}>{word.answer}</Text>
              <Text testID="dictation-meaning" style={[styles.meaning, { color: colors.textMuted }]}>{s.practiceTab.dictation.means(word.meaning)}</Text>
            </View>
          )}
        </Card>
      </View>
    </GameFrame>
  );
}

const BIG = tapTarget * 2;

const styles = StyleSheet.create({
  box: { marginHorizontal: spacing.xl },
  card: { borderRadius: radius.lg, padding: spacing.xl, gap: spacing.lg, alignItems: 'center' },
  brutalCard: { padding: spacing.xl, gap: spacing.lg, alignItems: 'center' },
  big: { width: BIG, height: BIG, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  bigBrutal: { alignSelf: 'center' },
  bigBrutalBox: { width: BIG, height: BIG, alignItems: 'center', justifyContent: 'center' },
  bigIcon: { fontSize: fontSize.xxl },
  link: { minHeight: tapTarget, justifyContent: 'center', paddingHorizontal: spacing.lg },
  linkText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  input: { width: '100%', borderWidth: 2, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontSize: fontSize.md },
  feedback: { alignItems: 'center', gap: spacing.sm },
  answer: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, textAlign: 'center' },
  meaning: { fontSize: fontSize.md, textAlign: 'center' },
});
