import { type ReactNode } from 'react';
import { StyleSheet, View, Text, Pressable, TextInput, ScrollView, Keyboard } from 'react-native';

import Colors from '@/constants/Colors';
import { getDb } from '@/lib/database';
import type { DueItem } from '@/lib/sessionQueue';
import { type Level } from '@/data/words';
import TappableSentence, { type TokenState } from '@/components/TappableSentence';
import FeedbackButton from '@/components/FeedbackModal';
import { speak as speakIn } from '@/lib/speech';
import { speechLang } from '@/lib/languages';
import { answerInputProps } from '@/lib/inputProps';
import type { stringsFor } from '@/lib/i18n';
import type { TypingResult } from '@/lib/learn/cardPresentation';

type Strings = ReturnType<typeof stringsFor>;
type ColorScheme = (typeof Colors)['light'];

type Props = {
  current: DueItem;
  direction: [string, string];
  level: Level;
  colors: ColorScheme;
  s: Strings;
  chrome: ReactNode;
  cardChips: ReactNode;
  iconBadge: ReactNode;
  photoBlock: ReactNode;
  noteBlock: ReactNode;
  noteButton: ReactNode;
  spellingTapLine: ReactNode;
  front: string;
  back: string;
  frontLang: string;
  backLang: string;
  isWord: boolean;
  revealed: boolean;
  setRevealed: (v: boolean) => void;
  spellingTokens: Record<string, TokenState>;
  spellingAdded: boolean;
  setSpellingAdded: (v: boolean) => void;
  practiceTyping: boolean;
  setPracticeTyping: (v: boolean) => void;
  practiceResult: TypingResult;
  setPracticeResult: (v: TypingResult) => void;
  practiceText: string;
  setPracticeText: (v: string) => void;
  checkPractice: () => void;
  onWordTap: (token: string, lang: string) => void;
  handleInSentence: () => void;
  handleWordGood: () => void;
  handleWordAgain: () => void;
  handleBuryWord: () => void;
  deferCurrent: (drop: boolean) => void;
  speakTarget: () => void;
};

export default function FlashcardScreen({
  current,
  direction,
  level,
  colors,
  s,
  chrome,
  cardChips,
  iconBadge,
  photoBlock,
  noteBlock,
  noteButton,
  spellingTapLine,
  front,
  back,
  frontLang,
  backLang,
  isWord,
  revealed,
  setRevealed,
  spellingTokens,
  spellingAdded,
  setSpellingAdded,
  practiceTyping,
  setPracticeTyping,
  practiceResult,
  setPracticeResult,
  practiceText,
  setPracticeText,
  checkPractice,
  onWordTap,
  handleInSentence,
  handleWordGood,
  handleWordAgain,
  handleBuryWord,
  deferCurrent,
  speakTarget,
}: Props) {
  // FB138, Kálmán 2026-08-17 (word:"the flashlight"): "ha le akarok írni egy szót
  // akkor tűnjön el a megfejtés ahogy le akarom írni, és lehessen beírni, majd ha
  // jó vagy ha rossz legyen ugyan az csak irjak ki hogy jó vagy rossz, és lehessen
  // újra beírni a szót". The solution sat above the practice field, so the exercise
  // was copying, and a miss closed the field for good. It now hides while the field
  // is open and comes back once the answer is right.
  const practiceHidesAnswer = practiceTyping && practiceResult !== 'correct';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {chrome}
      {/* FB102: same collapse as FB74/FB87, one screen lower. Opening the ℹ️
          note grows the card past the centered column, so it scrolls. */}
      <ScrollView
        style={styles.typingScroll}
        contentContainerStyle={styles.typingScrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >

      <Pressable
        style={[styles.card, { backgroundColor: colors.card }]}
        onPress={() => {
          // FB143: a tap beside the practice field closes the keyboard instead
          // of doing nothing.
          if (practiceTyping) { Keyboard.dismiss(); return; }
          if (!revealed) {
            setRevealed(true);
            // FB116: read the answer in whichever language it is, English included.
            speakIn(back, speechLang(backLang));
          }
        }}
      >
        {cardChips}
        <View style={styles.frontRow}>
          {iconBadge}
          {/* FB150: word-by-word tapping only once the card is open, before that a
              tap anywhere on the card is what reveals the answer. */}
          {revealed ? (
            <TappableSentence
              text={front}
              style={[styles.frontText, { color: colors.text }]}
              tokenStates={spellingTokens}
              onWordPress={token => onWordTap(token, frontLang)}
            />
          ) : (
            <Text style={[styles.frontText, { color: colors.text }]}>{front}</Text>
          )}
          <Pressable onPress={() => speakIn(front, speechLang(frontLang))} style={styles.speakBtn}>
            <Text style={styles.speakIcon}>🔊</Text>
          </Pressable>
          {noteButton}
        </View>
        {photoBlock}
        {noteBlock}

        {revealed ? (
          <View style={styles.backSection}>
            <View style={[styles.divider, { backgroundColor: '#38BDF8' }]} />
            {!practiceHidesAnswer && (
              <>
                <View style={styles.frontRow}>
                  <TappableSentence
                    text={back}
                    style={[styles.backText, { color: colors.tint }]}
                    tokenStates={spellingTokens}
                    onWordPress={token => onWordTap(token, backLang)}
                  />
                  <Pressable onPress={speakTarget} style={styles.speakBtn}>
                    <Text style={styles.speakIcon}>🔊</Text>
                  </Pressable>
                </View>
                {spellingTapLine}
              </>
            )}
            {!practiceTyping && !practiceResult && (
              <Pressable
                style={[styles.typeItBtn, { borderColor: colors.tabIconDefault }]}
                onPress={() => setPracticeTyping(true)}
              >
                <Text style={[styles.typeItText, { color: colors.tabIconDefault }]}>✏️ {s.card.typeIt}</Text>
              </Pressable>
            )}
            {practiceHidesAnswer && (
              <View style={styles.practiceSection}>
                {/* FB131: the open keyboard covers the buttons below the card, so
                    this practice field carries its own ✓ next to the input, the
                    same inline row the main typing card got in FB5. */}
                <View style={styles.inputRow}>
                  <TextInput
                    style={[styles.input, { width: '100%', color: colors.text, borderColor: colors.tabIconDefault }]}
                    placeholder={s.card.typeTranslation}
                    placeholderTextColor={colors.tabIconDefault}
                    value={practiceText}
                    onChangeText={(v) => {
                      setPracticeText(v);
                      // FB138: editing after a miss clears the verdict, so the same
                      // field can be typed again instead of ending on "wrong".
                      if (practiceResult) setPracticeResult(null);
                    }}
                    onSubmitEditing={checkPractice}
                    autoFocus
                    {...answerInputProps}
                  />
                  <Pressable style={[styles.inlineCheckBtn, { backgroundColor: '#38BDF8' }]} onPress={checkPractice}>
                    <Text style={styles.inlineCheckText}>{`✓ ${s.card.check}`}</Text>
                  </Pressable>
                </View>
              </View>
            )}
            {practiceResult && (
              <Text style={[styles.practiceResultText, { color: practiceResult === 'correct' ? '#22C55E' : practiceResult === 'almost' ? '#EAB308' : '#EF4444' }]}>
                {practiceResult === 'correct' ? s.card.correct : practiceResult === 'almost' ? s.card.almostCorrect : s.card.wrong}
              </Text>
            )}
          </View>
        ) : (
          <Text style={[styles.tapHint, { color: colors.tabIconDefault }]}>
            {s.card.tapToReveal}
          </Text>
        )}
      </Pressable>

      <View style={[styles.buttons, { opacity: revealed ? 1 : 0 }]} pointerEvents={revealed ? 'auto' : 'none'}>
        {isWord && (
          <Pressable
            style={[styles.button, { backgroundColor: colors.accent }]}
            onPress={handleInSentence}
          >
            <Text style={styles.buttonText}>{s.buttons.inSentence}</Text>
          </Pressable>
        )}
        <Pressable
          style={[styles.button, { backgroundColor: '#38BDF8' }]}
          onPress={handleWordGood}
        >
          <Text style={styles.buttonText}>{s.buttons.good}</Text>
        </Pressable>
        <Pressable
          style={[styles.button, { backgroundColor: '#1D4ED8' }]}
          onPress={handleWordAgain}
        >
          <Text style={styles.buttonText}>{s.buttons.again}</Text>
        </Pressable>
      </View>

      {revealed && (
        <Pressable
          style={({ pressed }) => [styles.buryBtn, pressed && { backgroundColor: '#22C55E', borderRadius: 8 }]}
          onPress={handleBuryWord}
        >
          {({ pressed }) => <Text style={[styles.buryText, pressed && { color: '#FFFFFF' }]}>{s.buttons.iKnowThis}</Text>}
        </Pressable>
      )}

      {/* FB38: snooze the word 3 days without any SRS write. */}
      {revealed && (
        <Pressable
          style={({ pressed }) => [styles.buryBtn, pressed && { backgroundColor: '#22C55E', borderRadius: 8 }]}
          onPress={() => {
            const db = getDb();
            db.snoozeCard(current.wordId, current.type, 3).catch(() => {});
            deferCurrent(true);
          }}
        >
          {({ pressed }) => <Text style={[styles.buryText, pressed && { color: '#FFFFFF' }]}>{s.buttons.snooze}</Text>}
        </Pressable>
      )}

      {/* FB39: add the word to the spelling-practice list, dedup on the DB side. */}
      {revealed && (
        <Pressable
          style={({ pressed }) => [styles.buryBtn, pressed && { backgroundColor: '#22C55E', borderRadius: 8 }]}
          onPress={() => {
            const db = getDb();
            db.addToSpellingList(current.wordId).catch(() => {});
            setSpellingAdded(true);
          }}
        >
          {({ pressed }) => <Text style={[styles.buryText, pressed && { color: '#FFFFFF' }]}>{spellingAdded ? `${s.buttons.spelling} ✓` : s.buttons.spelling}</Text>}
        </Pressable>
      )}
      </ScrollView>

      <FeedbackButton level={level} languagePair={direction.join('→')} currentCard={`${current.type}:${front}`} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  card: {
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    minHeight: 260,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  frontText: {
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    // FB110: a long sentence used to push the 🔊 and ℹ️ buttons off the card
    // ("az i betű az informationak kicsit bele van lógva a kép szélére"). The
    // text yields width instead, the buttons stay inside.
    flexShrink: 1,
  },
  backSection: {
    alignItems: 'center',
    width: '100%',
  },
  divider: {
    height: 2,
    width: '60%',
    borderRadius: 1,
    marginBottom: 16,
  },
  backText: {
    fontSize: 28,
    fontWeight: '600',
    textAlign: 'center',
  },
  tapHint: {
    fontSize: 14,
    marginTop: 8,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 32,
    minHeight: 50,
  },
  button: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    minWidth: 90,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  frontRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    maxWidth: '100%',
    gap: 8,
    marginBottom: 16,
  },
  speakBtn: {
    padding: 4,
  },
  speakIcon: {
    fontSize: 22,
  },
  typeItBtn: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  typeItText: {
    fontSize: 13,
    fontWeight: '500',
  },
  practiceSection: {
    width: '100%',
    marginTop: 12,
  },
  practiceResultText: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  input: {
    width: '100%',
    borderWidth: 2,
    borderRadius: 12,
    padding: 14,
    fontSize: 18,
    textAlign: 'center',
    marginTop: 8,
  },
  // FB160, Kálmán 2026-08-26: the field and the check button stack, the button is
  // a long bar the right thumb reaches with the keyboard open.
  inputRow: {
    width: '100%',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
  },
  // FB167, Kálmán 2026-08-29: "az új check gomb nagyon egyenletlen így, legyen
  // szűkebb és szélesebb". The 82% right-biased bar left uneven margins; it is
  // now full width (even on both sides) and lower.
  inlineCheckBtn: {
    alignSelf: 'stretch',
    width: '100%',
    minHeight: 44,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineCheckText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  typingScroll: {
    flex: 1,
    width: '100%',
  },
  typingScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingTop: 16,
    paddingBottom: 24,
  },
  buryBtn: {
    alignSelf: 'center',
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  buryText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
  },
});
