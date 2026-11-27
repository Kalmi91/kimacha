import { awardXpThen } from '@/lib/xpAward';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '@/components/KText';
import { useLocalSearchParams, useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { dismissKeyboardOnTap, keyboardDismissOnDrag } from '@/lib/keyboardTap';
import { useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { softTitleStyle } from '@/components/grammar/Brutal';
import { brutalHeaderRowStyle } from '@/lib/brutalHeader';
import { themedInputStyle, themedEdgeStyle, BackButton, ProgressBar, ActionButton } from '@/components/grammar/Themed';
import { t } from '@/lib/i18n';
import { getDb } from '@/lib/database';
import { useLearner } from '@/lib/learner';
import { useLoadOnMount } from '@/lib/useLoadOnMount';
import { useSessionProgress } from '@/lib/useSessionProgress';
import { countLearningToday } from '@/lib/learningDay';
import type { Level } from '@/data/words';
import { strictAnswerMatch } from '@/lib/answerMatch';
import { speak } from '@/lib/speech';
import { activeSourceFor, pairOf, type Lang } from '@/lib/languagePair';
import { speechLang } from '@/lib/languages';
import { answerInputProps } from '@/lib/inputProps';
import { useFocusOnNewCard } from '@/lib/learn/useFocusOnNewCard';
import { GRAMMAR_PROGRESS_KEY, lessonFor, syllabusTopic } from '@/lib/grammar/syllabus';
import {
  answerCell,
  doneCount,
  mergeDeckState,
  nextCellId,
  resetDeckInOrder,
  resetDeckShuffled,
  tableCellsForLesson,
  wordCellsForLesson,
  type DeckState,
} from '@/lib/grammar/tableDeck';
import ScreenFeedback from '@/lib/screenFeedback';
import { FEEDBACK_CORNER_CLEAR } from '@/components/learn/pcicStyles';
import FitText from '@/components/FitText';
import SpeakButton from '@/components/SpeakButton';
import { isInfinitive } from '@/lib/grammar/tableShape';
import CardShell from '@/components/learn/CardShell';
import DockedAction, { DOCK_RESERVE, FAB_CLEARANCE } from '@/components/learn/DockedAction';
import AnswerCompare from '@/components/grammar/AnswerCompare';
import AnswerFeedbackBox from '@/components/grammar/AnswerFeedbackBox';
import { DAILY_XP_GOAL } from '@/lib/dailyXp';
import { useXpToday } from '@/lib/useXpToday';
import { useDockLift } from '@/components/learn/useDockLift';
import { useWebKeyboardOpen, WEB_TYPING_PADDING } from '@/lib/webKeyboard';

// Practices the cells of the lesson's conjugation
// tables on the PCIC card surface (CardShell,
// DockedAction), with Anki-like scheduling (lib/grammar/tableDeck.ts).
// Progress persists to game_progress under the ${topic}:tabledeck key, the same
// game_id (GRAMMAR_PROGRESS_KEY) as the lesson scores.
//
// On a table-less lesson the card source is the lesson's
// own words (wordCellsForLesson), not the conjugation table; the scheduler and
// the screen are the same, only the promptBig text and the chip label differ by mode.

const progressKeyFor = (topicId: string) => `${topicId}:tabledeck`;

type DeckMode = 'table' | 'word';

interface DeckItem {
  id: string;
  /** The Spanish word/form to type. */
  answer: string;
  /** The big prompt text: "person · verb" for a table cell, the English
   *  meaning for a word card. */
  promptBig: string;
  /** the cell's English prompt ("she spoke"), table cells only; when
   *  set, promptBig shows it (with `verb` as the infinitive underneath)
   *  instead of the bare person·verb prompt. */
  enPrompt?: string;
  /** The table cell's infinitive, shown under an enPrompt. */
  verb?: string;
  /** the conjugation cell's infinitive is hidden, shown on the hint button (or
   *  after Check); there is none for a column header (person table) or a word deck. */
  hintVerb?: boolean;
}

export default function TableDeckScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const xpToday = useXpToday();
  const s = t();
  const router = useRouter();
  const { persistRow } = useSessionProgress();
  const { topic: topicId } = useLocalSearchParams<{ topic: string }>();

  const [loading, setLoading] = useState(true);
  const [learnedLang, setLearnedLang] = useState('es');
  const [level, setLevel] = useState<Level>('A1');
  // one setting, two places, see the head of
  // lib/grammar/tableDeck.ts.
  const { strictAccents, againDelaySec, refresh } = useLearner();
  const [mode, setMode] = useState<DeckMode>('table');
  const [items, setItems] = useState<DeckItem[]>([]);
  const [deck, setDeck] = useState<DeckState>({ cells: [], resetCount: 0, shuffled: false });
  const [typed, setTyped] = useState('');
  const [checked, setChecked] = useState<{ correct: boolean } | null>(null);
  // every wrong answer of this visit, listed on the end screen (FB708); "I mistyped" does not count
  const [misses, setMisses] = useState<{ prompt: string; given: string; correct: string }[]>([]);
  // the XP the last right answer gave (FB591); the chip fades it
  const [, setEarned] = useState(0);
  // id of the cell for which the hint button was pressed
  // (derived as "not pressed" on a card change, so no reset effect).
  const [hintFor, setHintFor] = useState<string | null>(null);
  // the input field remounts for every new cell
  // (the `key` contains this counter), otherwise `autoFocus` only runs on the first
  // cell, and on a native field that is disabled after Check (`editable={false}`) and then
  // re-enabled, the keyboard does not come up after Next. Same cause and
  // fix as on the PCIC card (app/(tabs)/index.tsx cardSeq).
  const [cellSeq, setCellSeq] = useState(0);
  const { dockLift } = useDockLift();
  const [dockH, setDockH] = useState(DOCK_RESERVE);
  const webKeyboardOpen = useWebKeyboardOpen();
  // React Compiler purity rule: Date.now() may not be called during render
  // (lib/grammar/tableDeck.ts's nextCellId needs "now" to pick the due
  // cell), so it lives in state, refreshed right after every action that can
  // change which cell is due (load, a check/next round, Start again).
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    const db = getDb();
    const id = String(topicId);
    const { target } = await refresh(['direction']);
    setLearnedLang(target);
    const lesson = lessonFor(target, id);
    const tableCells = tableCellsForLesson(lesson, target);
    // table cells win where they exist (unchanged behavior); a
    // table-less lesson falls back to its own word-deck.
    const deckMode: DeckMode = tableCells.length > 0 ? 'table' : 'word';
    const itemList: DeckItem[] =
      deckMode === 'table'
        ? tableCells.map((c) => ({
            id: c.id,
            answer: c.answer,
            // the hidden infinitive is not in the prompt (the hint button shows it).
            promptBig: c.enPrompt ?? (isInfinitive(c.verb) ? c.person : `${c.person} · ${c.verb}`),
            enPrompt: c.enPrompt,
            verb: c.verb,
            hintVerb: isInfinitive(c.verb),
          }))
        : // in es→en the question is the Spanish word, the answer is the English word.
          wordCellsForLesson(lesson, target).map((c) =>
            target === 'en' ? { id: c.id, answer: c.en, promptBig: c.es } : { id: c.id, answer: c.es, promptBig: c.en }
          );
    await refresh(['strictAccents', 'againDelaySec']);
    const levelData = await db.getLevel();
    const rows = await db.getGameProgress(GRAMMAR_PROGRESS_KEY);
    const saved = rows.find((r) => r.itemId === progressKeyFor(id));
    const persisted = saved?.data as DeckState | undefined;
    setLevel((levelData.level as Level) ?? 'A1');
    setMode(deckMode);
    setItems(itemList);
    setDeck(mergeDeckState(itemList, id, persisted));
    setTyped('');
    setChecked(null);
    setNow(Date.now());
    setLoading(false);
    // setTyped is listed because the React Compiler infers it as a
    // dependency of this async callback (the input's onChangeText={setTyped}
    // below makes it "reactive"; see the identical note
    // in app/(tabs)/index.tsx's own `load`). It is stable, so nothing
    // changes at runtime, but leaving it out counts as broken memoization.
  }, [topicId, setTyped, refresh]);

  useLoadOnMount(load);

  const persist = (next: DeckState) => {
    persistRow(GRAMMAR_PROGRESS_KEY, progressKeyFor(String(topicId)), 'progress', next);
  };

  const entry = syllabusTopic(String(topicId), learnedLang);
  // the title is in the learner's own language (the pair's source), English where a title has no text in it.
  const lessonTitle = entry?.title[activeSourceFor(learnedLang as Lang)] ?? entry?.title.en ?? String(topicId);

  // The FeedbackButton's pair label with the active direction (en→es or es→en).
  const deckPair = pairOf(learnedLang as Lang);

  const currentId = nextCellId(deck, now);
  const current = currentId ? items.find((c) => c.id === currentId) : undefined;
  const complete = items.length > 0 && !current;
  const inputRef = useRef<TextInput>(null);
  useFocusOnNewCard(inputRef, !loading && !!current, `${current?.id}-${cellSeq}`);

  const handleCheck = () => {
    if (!current) return;
    const correct = typed.trim().length > 0 && strictAnswerMatch(typed, current.answer, { strictAccents, lang: learnedLang });
    setChecked({ correct });
    setEarned(0);
    if (correct) awardXpThen('grammar', `deck:${current.id}`, setEarned);
    speak(current.answer, speechLang(learnedLang));
  };

  // `asRight` = the "I mistyped" button: a wrong answer counts as right (FB723).
  const advance = (asRight: boolean) => {
    if (!current || !checked) return;
    if (!asRight && !checked.correct) setMisses((m) => [...m, { prompt: current.enPrompt ? `${current.enPrompt}${current.verb ? ` (${current.verb})` : ''}` : current.promptBig, given: typed.trim(), correct: current.answer }]);
    const nowMs = Date.now();
    const next = answerCell(deck, current.id, asRight || checked.correct, nowMs, againDelaySec * 1000);
    setDeck(next);
    persist(next);
    void countLearningToday();
    setTyped('');
    setChecked(null);
    setNow(nowMs);
    setCellSeq((n) => n + 1);
  };
  const handleNext = () => advance(false);

  const handleStartAgain = () => {
    const fresh = resetDeckInOrder(items);
    setMisses([]);
    setDeck(fresh);
    persist(fresh);
    setTyped('');
    setChecked(null);
    setNow(Date.now());
  };

  // "Harder: shuffled" - all cells again, but shuffled this time
  // (resetDeckInOrder above is the plain restart, in the deck's own order).
  const handleHarder = () => {
    const fresh = resetDeckShuffled(items, String(topicId), deck.resetCount);
    setMisses([]);
    setDeck(fresh);
    persist(fresh);
    setTyped('');
    setChecked(null);
    setNow(Date.now());
  };

  // one line: back, title (shrinks, then ellipsis), room for the feedback button (FB722).
  const header = (
    <View style={[styles.header, brutalHeaderRowStyle(g)]}>
      <BackButton testID="tabledeck-back" onPress={() => router.back()} arrowStyle={[styles.back, { color: colors.text }]} />
      <FitText variant="title" base={17} maxLines={1} numberOfLines={1} reserve={(g.brutal ? 90 : 60) + FEEDBACK_CORNER_CLEAR} caps={g.brutal} style={[styles.title, { color: colors.text }, g.brutal && styles.brutalTitle, softTitleStyle(g)]}>
        {lessonTitle}
      </FitText>
      <View style={styles.cornerClear} />
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  const pct = items.length > 0 ? (doneCount(deck) / items.length) * 100 : 0;

  const progressBar = (
    <ProgressBar testID="tabledeck-segments" pct={pct} brutalStyle={styles.brutalBar} trackStyle={styles.progressTrack} trackColor={colors.card} fillStyle={styles.progressFill} fillColor={colors.successFill} />
  );

  // "2 / 130 done" left, "XP 2/50" right, under the bar (FB722).
  const metaRow = (
    <View style={styles.metaRow}>
      <Text style={[styles.metaText, { color: colors.tabIconDefault }]}>{s.tableDeck.progress(doneCount(deck), items.length)}</Text>
      <Text style={[styles.metaText, { color: colors.tabIconDefault }]}>{s.pcic.badgeXp(xpToday, DAILY_XP_GOAL)}</Text>
    </View>
  );

  if (complete) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {header}
        {progressBar}
        {metaRow}
        <ScrollView contentContainerStyle={styles.doneBody}>
          <Text style={styles.doneEmoji}>🎉</Text>
          <Text variant="title" style={[styles.doneTitle, { color: colors.text }]}>{s.tableDeck.completeTitle(items.length)}</Text>
          <ActionButton
            testID="tabledeck-start-again"
            fill="a"
            label={s.tableDeck.startAgain}
            onPress={handleStartAgain}
            brutalStyle={styles.brutalBtn}
            classicStyle={[styles.btn, { backgroundColor: colors.tint }]}
            classicTextStyle={[styles.btnTextOnTint, { color: colors.onTint }]}
            classicRole={null}
          />
          {/* same pill shape/size as "Start again" (outline instead
              of filled), so the two options read as equally-weighted choices. */}
          <ActionButton
            testID="tabledeck-harder"
            fill="paper"
            label={s.tableDeck.harder}
            onPress={handleHarder}
            brutalStyle={styles.brutalBtn}
            classicStyle={[styles.btn, styles.btnOutline, { borderColor: colors.tint }]}
            classicTextStyle={[styles.btnTextOnTint, { color: colors.tint }]}
            classicRole={null}
          />
          <Pressable style={styles.ghostBtn} onPress={() => router.back()}>
            <Text style={[styles.ghostBtnText, { color: colors.tabIconDefault }]}>{s.tableDeck.backToLesson}</Text>
          </Pressable>
          {misses.length > 0 ? (
            <View testID="tabledeck-mistakes" style={styles.missList}>
              <Text style={[styles.missTitle, { color: colors.tabIconDefault }]}>{s.grammar.mistakesTitle}</Text>
              {misses.map((m, i) => (
                <View key={i} testID="tabledeck-mistake" style={styles.miss}>
                  <Text style={[styles.missPrompt, { color: colors.text }]}>{m.prompt}</Text>
                  {m.given ? <Text style={[styles.missPrompt, { color: colors.danger, textDecorationLine: 'line-through' }]}>{m.given}</Text> : null}
                  <Text style={[styles.missPrompt, { color: colors.success }]}>{m.correct}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
        <ScreenFeedback level={level} languagePair={deckPair} currentCard={`grammar:${topicId}:tabledeck`} />
      </View>
    );
  }

  if (!current) {
    // No conjugation table AND no word-deck cards for this lesson (direct
    // link / stale state).
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {header}
        {/* the 💬 is there on the empty deck's page too. */}
        <ScreenFeedback level={level} languagePair={deckPair} currentCard={`grammar:${topicId}:tabledeck:empty`} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }, webKeyboardOpen && WEB_TYPING_PADDING]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {header}
      {!webKeyboardOpen && progressBar}
      {metaRow}

      <ScrollView
        style={styles.cardScroll}
        contentContainerStyle={[styles.cardScrollContent, { paddingBottom: FAB_CLEARANCE + dockH + dockLift }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={keyboardDismissOnDrag()}
      >
        <CardShell compact colors={colors} onPress={dismissKeyboardOnTap}>
          {mode === 'word' ? (
            <Text style={[styles.promptCaption, { color: colors.tabIconDefault }]}>
              {learnedLang === 'en' ? s.tableDeck.wordPromptCaptionEn : s.tableDeck.wordPromptCaption}
            </Text>
          ) : null}
          <FitText variant="word" base={32} maxLines={3} reserve={100} style={[styles.promptBig, { color: colors.text }]}>
            {current.promptBig}
          </FitText>
          {/* a meaning-table cell (lib/grammar/tableDeck.ts) has no
              infinitive to show underneath (verb: ''), so this caption stays
              hidden there instead of rendering an empty line. */}
          {current.hintVerb && hintFor !== current.id && !checked ? (
            <SpeakButton
              testID="tabledeck-hint"
              icon="💡"
              label={s.tableDeck.showVerb}
              onPress={() => setHintFor(current.id)}
              style={styles.hintBtn}
              brutalStyle={styles.hintBtnBrutal}
              labelStyle={[styles.hintLabel, { color: colors.tint }]}
            />
          ) : (current.hintVerb || current.enPrompt) && current.verb ? (
            <View testID="tabledeck-infinitive" style={[styles.infChip, { backgroundColor: colors.background, borderColor: colors.tabIconDefault }, themedEdgeStyle(g)]}>
              <Text style={[styles.infChipText, { color: colors.text }]}>{current.verb}</Text>
            </View>
          ) : null}

          <TextInput
            key={`deck-in-${current.id}-${cellSeq}`}
            ref={inputRef}
            testID="tabledeck-input"
            style={[styles.input, { color: colors.text, borderColor: colors.tabIconDefault }, themedInputStyle(g)]}
            value={typed}
            onChangeText={setTyped}
            onSubmitEditing={checked ? handleNext : handleCheck}
            editable={!checked}
            placeholder={s.card.typeIn(learnedLang)}
            placeholderTextColor={colors.tabIconDefault}
            {...answerInputProps}
          />

          {checked && (
            <AnswerFeedbackBox
              testID="tabledeck-result"
              correct={checked.correct}
              badgeLabel={checked.correct ? s.grammar.correct : s.randomRound.wrong}
              badgeTestID="tabledeck-result-badge"
              style={styles.resultSection}
            >
              {checked.correct ? (
                <Text variant="word" style={[styles.correctAnswer, { color: colors.text }]}>{current.answer}</Text>
              ) : (
                <>
                  {typed.trim() ? (
                    <AnswerCompare typed={typed.trim()} correct={current.answer} g={g} />
                  ) : (
                    <Text variant="word" style={[styles.correctAnswer, { color: colors.success }]}>{current.answer}</Text>
                  )}
                  <SpeakButton onPress={() => speak(current.answer, speechLang(learnedLang))} style={styles.speakBtn} iconStyle={styles.speakIcon} />
                </>
              )}
            </AnswerFeedbackBox>
          )}
        </CardShell>
      </ScrollView>

      {/* Check / Next on the docked bar above the keyboard, like every other grammar and word card (FB747, FB748) */}
      <DockedAction
        testID="learn-docked-action"
        tone={checked ? 'next' : 'check'}
        onPress={checked ? handleNext : handleCheck}
        secondary={checked && !checked.correct ? { label: s.grammar.mistyped, testID: 'grammar-mistyped', onPress: () => advance(true) } : undefined}
        bottom={dockLift}
        colors={colors}
        onHeight={setDockH}
      />

      <ScreenFeedback
        level={level}
        languagePair={deckPair}
        currentCard={`grammar:${topicId}:tabledeck:${current.id}`}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'flex-start' },
  centered: { justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  back: { fontSize: 22 },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', paddingHorizontal: 8 },
  brutalTitle: { textTransform: 'uppercase', fontWeight: '500' },
  brutalBar: { marginBottom: 16 },
  brutalBtn: { alignSelf: 'stretch', marginTop: 10 },
  cornerClear: { width: FEEDBACK_CORNER_CLEAR },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -8, marginBottom: 8 },
  metaText: { fontSize: 13, fontVariant: ['tabular-nums'] },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 16 },
  progressFill: { height: '100%', borderRadius: 3 },
  cardScroll: { flex: 1, width: '100%' },
  cardScrollContent: { flexGrow: 1, justifyContent: 'flex-start', paddingTop: 8 },
  promptCaption: { fontSize: 13, textAlign: 'center', marginBottom: 8 },
  promptBig: { fontSize: 32, fontWeight: '700', textAlign: 'center', marginBottom: 12 },
  // the infinitive chip under the prompt (replaces the TABLE chip and the caption).
  infChip: { alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 4, borderRadius: 999, borderWidth: 1, marginBottom: 14 },
  infChipText: { fontSize: 15, fontStyle: 'italic' },
  // The hidden infinitive's hint button: centered under the prompt.
  hintBtn: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 10, marginBottom: 8 },
  hintBtnBrutal: { alignSelf: 'center', marginBottom: 8 },
  hintLabel: { fontSize: 14, fontWeight: '600' },
  input: { width: '100%', borderWidth: 2, borderRadius: 12, padding: 14, fontSize: 18, textAlign: 'center' },
  resultSection: { alignItems: 'center', marginTop: 16, gap: 4 },
  resultHead: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  frontRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  correctAnswer: { flexShrink: 1, fontSize: 26, fontWeight: '700', textAlign: 'center' },
  speakBtn: { padding: 4, flexShrink: 0 },
  speakIcon: { fontSize: 22 },
  doneBody: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingBottom: 40 },
  missList: { alignSelf: 'stretch', paddingHorizontal: 20, gap: 10 },
  missTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
  miss: { gap: 2 },
  missPrompt: { fontSize: 16, fontWeight: '600' },
  doneEmoji: { fontSize: 52 },
  doneTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  btn: {
    marginTop: 10,
    alignSelf: 'stretch',
    paddingVertical: 14,
    borderRadius: 26,
    alignItems: 'center',
  },
  btnTextOnTint: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  // "Harder: shuffled" pill, same size as `btn`, outline instead of filled.
  btnOutline: { backgroundColor: 'transparent', borderWidth: 2 },
  ghostBtn: { marginTop: 4, padding: 8 },
  ghostBtnText: { fontSize: 14 },
});
