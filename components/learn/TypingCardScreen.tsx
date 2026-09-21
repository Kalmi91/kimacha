import { type ReactNode, type RefObject } from 'react';
import { StyleSheet, View, Text, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';

import Colors from '@/constants/Colors';
import { getDb } from '@/lib/database';
import type { DueItem } from '@/lib/sessionQueue';
import { type Level } from '@/data/words';
import TappableSentence, { type TokenState } from '@/components/TappableSentence';
import { charDiff } from '@/lib/charDiff';
import { ARTICLE_OPTIONS, articlePickerApplies, composeAnswer, type ArticlePick } from '@/lib/articlePicker';
import FeedbackButton from '@/components/FeedbackModal';
import CardShell from '@/components/learn/CardShell';
import DockedAction, { DOCK_RESERVE } from '@/components/learn/DockedAction';
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
  typingResult: TypingResult;
  revealed: boolean;
  typedAnswer: string;
  setTypedAnswer: (v: string) => void;
  articlePick: ArticlePick;
  setArticlePick: (v: ArticlePick) => void;
  articlePickerOn: boolean;
  spellingTokens: Record<string, TokenState>;
  spellingAdded: boolean;
  setSpellingAdded: (v: boolean) => void;
  strictAccents: boolean;
  dockLift: number;
  inputRef: RefObject<TextInput | null>;
  onWordTap: (token: string, lang: string) => void;
  handleCheck: () => void;
  handleTypingNext: () => void;
  applyAnswer: (correct: boolean) => void;
  handleBuryWord: () => void;
  deferCurrent: (drop: boolean) => void;
  speakTarget: () => void;
};

export default function TypingCardScreen({
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
  typingResult,
  revealed,
  typedAnswer,
  setTypedAnswer,
  articlePick,
  setArticlePick,
  articlePickerOn,
  spellingTokens,
  spellingAdded,
  setSpellingAdded,
  strictAccents,
  dockLift,
  inputRef,
  onWordTap,
  handleCheck,
  handleTypingNext,
  applyAnswer,
  handleBuryWord,
  deferCurrent,
  speakTarget,
}: Props) {
  const resultColor = typingResult === 'correct' ? '#22C55E' : typingResult === 'almost' ? '#EAB308' : typingResult === 'skipped' ? colors.tabIconDefault : '#EF4444';
  const resultText = typingResult === 'correct' ? s.card.correct : typingResult === 'almost' ? s.card.almostCorrect : typingResult === 'skipped' ? s.card.skipped : s.card.wrong;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {chrome}
      {/* FB74: once the result block appears the card grows, so it scrolls
          instead of colliding with anything on small screens. */}
      <ScrollView
        style={styles.typingScroll}
        // FB170: leave room for the docked Check bar and the keyboard under it,
        // otherwise the last line of the card would end up behind them.
        contentContainerStyle={[styles.typingScrollContent, { paddingBottom: 24 + DOCK_RESERVE + dockLift }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >

      {/* FB143, Kálmán 2026-08-19: "nem megy le a billentyűzet ha félre
          kattintok". The card is the area beside the field, so a tap on it
          closes the keyboard; the ✓ button and the speaker keep working,
          they handle their own press. */}
      <CardShell compact colors={colors} onPress={() => Keyboard.dismiss()}>
        {cardChips}
        <View style={[styles.frontRow, { marginBottom: 16 }]}>
          {iconBadge}
          {/* FB150: the prompt is tappable word by word, straight into spelling practice. */}
          <TappableSentence
            text={front}
            style={[styles.frontText, { color: colors.text }]}
            tokenStates={spellingTokens}
            onWordPress={token => onWordTap(token, frontLang)}
          />
          <Pressable onPress={() => speakIn(front, speechLang(frontLang))} style={styles.speakBtn}>
            <Text style={styles.speakIcon}>🔊</Text>
          </Pressable>
          {noteButton}
        </View>
        {photoBlock}
        {noteBlock}

        {/* FB5, then FB170: the input row used to carry its own ✓/→ because the
            button below the card could hide under the keyboard. The single Check
            is docked above the keyboard now, so the row is just the field. */}
        {/* FB188: névelő-gombsor. Minden spanyol szó-kártyán ott van, akkor is,
            ha a helyes alak névelőtlen, különben a puszta megjelenése elárulná,
            hogy kell névelő. ⊘ az alapállás, tehát aki nem nyúl hozzá, gépel.
            FB214: igénél és melléknévnél is ott a sor, ⊘-val a helyes válasz. */}
        {articlePickerOn && articlePickerApplies(backLang, current.type === 'word', back) && (
          <View style={styles.articleRow}>
            {([...ARTICLE_OPTIONS, ''] as ArticlePick[]).map((opt) => {
              const active = articlePick === opt;
              return (
                <Pressable
                  key={opt || 'none'}
                  disabled={revealed}
                  onPress={() => setArticlePick(active ? '' : opt)}
                  style={[
                    styles.articleChip,
                    {
                      backgroundColor: active ? colors.tint : colors.card,
                      opacity: revealed ? 0.6 : 1,
                    },
                  ]}
                  accessibilityLabel={opt || 'sin artículo'}
                >
                  <Text style={[styles.articleChipText, { color: active ? colors.background : colors.text }]}>
                    {opt || '⊘'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={styles.inputRow}>
          <TextInput
            ref={inputRef}
            style={[styles.input, { width: '100%', color: colors.text, borderColor: typingResult ? resultColor : colors.tabIconDefault }]}
            placeholder={s.card.typeTranslation}
            placeholderTextColor={colors.tabIconDefault}
            value={typedAnswer}
            onChangeText={setTypedAnswer}
            onSubmitEditing={revealed ? handleTypingNext : handleCheck}
            editable={!revealed}
            autoFocus
            {...answerInputProps}
          />
        </View>

        {revealed && (
          <View style={styles.resultSection}>
            <Text style={[styles.resultText, { color: resultColor }]}>{resultText}</Text>
            {typingResult === 'wrong' && composeAnswer(articlePick, typedAnswer).length > 0 && (
              <Text style={styles.diffLine}>
                {/* FB132: with strict accents on, a dropped tilde is the mistake,
                    so the diff must paint it instead of folding it away. */}
                {charDiff(composeAnswer(articlePick, typedAnswer), back.split(' / ')[0], { accents: !strictAccents }).map((d, i) => (
                  <Text
                    key={i}
                    style={d.missing ? styles.diffMissing : d.wrong ? styles.diffWrong : { color: colors.text }}
                  >
                    {d.ch}
                  </Text>
                ))}
              </Text>
            )}
            <View style={styles.frontRow}>
              <TappableSentence
                text={back}
                style={[styles.correctAnswer, { color: colors.tint }]}
                tokenStates={spellingTokens}
                onWordPress={token => onWordTap(token, backLang)}
              />
              <Pressable onPress={speakTarget} style={styles.speakBtn}>
                <Text style={styles.speakIcon}>🔊</Text>
              </Pressable>
            </View>
            {spellingTapLine}
          </View>
        )}
      </CardShell>

      {/* Kálmán 2026-09-10: "Helyes ez így". Az automata ellenőrzés hibásnak
          mondta, de a gépelt válasz mégis jó (pl. elfogadható szinonima), ezért
          kézzel Rating.Good. Eltemetés nincs, a kártya marad az ismétlésben. */}
      {revealed && typingResult === 'wrong' && (
        <Pressable
          style={({ pressed }) => [styles.buryBtn, pressed && { backgroundColor: '#22C55E', borderRadius: 8 }]}
          onPress={() => applyAnswer(true)}
        >
          {({ pressed }) => <Text style={[styles.buryText, pressed && { color: '#FFFFFF' }]}>{s.buttons.correctAsIs}</Text>}
        </Pressable>
      )}

      <Pressable
        style={({ pressed }) => [styles.buryBtn, pressed && { backgroundColor: '#22C55E', borderRadius: 8 }]}
        onPress={handleBuryWord}
      >
        {({ pressed }) => <Text style={[styles.buryText, pressed && { color: '#FFFFFF' }]}>{s.buttons.iKnowThis}</Text>}
      </Pressable>

      {/* FB38: snooze the word 3 days without any SRS write. */}
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

      {/* FB39: add the word to the spelling-practice list, dedup on the DB side. */}
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
      </ScrollView>

      {/* FB170: the one and only Check/→ of the typing card, pinned to the top
          edge of the keyboard (or to the bottom of the screen when it is closed). */}
      <DockedAction
        label={revealed ? '→' : `✓ ${s.card.check}`}
        onPress={revealed ? handleTypingNext : handleCheck}
        tone={revealed ? 'next' : 'check'}
        color={revealed && typingResult === 'wrong' ? '#1D4ED8' : '#38BDF8'}
        bottom={dockLift}
        colors={colors}
      />

      {/* FB173, Kálmán 2026-09-06: "feedback gomb egybe csúszott". The 💬 button sits
          at bottom: 24, which is inside the docked Check bar; it rides above it. */}
      <FeedbackButton
        level={level}
        languagePair={direction.join('→')}
        currentCard={`${current.type}:${front}`}
        bottomOffset={DOCK_RESERVE + dockLift}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
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
  frontText: {
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    // FB110: a long sentence used to push the 🔊 and ℹ️ buttons off the card
    // ("az i betű az informationak kicsit bele van lógva a kép szélére"). The
    // text yields width instead, the buttons stay inside.
    flexShrink: 1,
  },
  speakBtn: {
    padding: 4,
  },
  speakIcon: {
    fontSize: 22,
  },
  // FB170: the single Check button of the typing card, docked above the keyboard.
  // FB188: a névelő-gombsor a beviteli mező fölött, egy sorban öt gombbal.
  articleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  articleChip: {
    minWidth: 48,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  articleChipText: {
    fontSize: 16,
    fontWeight: '600',
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
  resultSection: {
    alignItems: 'center',
    marginTop: 12,
  },
  typingScroll: {
    flex: 1,
    width: '100%',
  },
  typingScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    // ITER5: was 56, the room the absolute header needed. The chrome sits in
    // the flow above this scroll view now, so this is plain breathing space.
    paddingTop: 16,
    paddingBottom: 24,
  },
  resultText: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  diffLine: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 6,
  },
  diffWrong: {
    backgroundColor: '#EF4444',
    color: '#FFFFFF',
  },
  // FB84: amber + underline for a letter that was left out, so it reads apart
  // from the red "you typed the wrong letter here" marks.
  diffMissing: {
    backgroundColor: '#EAB308',
    color: '#FFFFFF',
    textDecorationLine: 'underline',
  },
  correctAnswer: {
    fontSize: 22,
    fontWeight: '600',
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
