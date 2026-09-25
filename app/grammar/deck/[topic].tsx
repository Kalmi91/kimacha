import { useCallback, useState } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { getDb } from '@/lib/database';
import { useLoadOnMount } from '@/lib/useLoadOnMount';
import type { Level } from '@/data/words';
import { charDiff } from '@/lib/charDiff';
import { strictAnswerMatch } from '@/lib/answerMatch';
import { speak } from '@/lib/speech';
import { speechLang } from '@/lib/languages';
import { answerInputProps } from '@/lib/inputProps';
import { DEFAULT_AGAIN_DELAY_SEC } from '@/lib/pcicSession';
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
import FeedbackButton from '@/components/FeedbackModal';
import CardShell from '@/components/learn/CardShell';
import DockedAction, { DOCK_RESERVE } from '@/components/learn/DockedAction';
import { useDockLift } from '@/components/learn/useDockLift';

// PLAN-play 13. lépés (s6, jóváhagyó lap
// https://claude.ai/artifact/HsKKPddM4KKt7wBQZmLVNo): a lecke ragozó
// tábláinak celláit gyakorolja, a PCIC-kártya felületén (CardShell,
// DockedAction), Anki-szerű ütemezéssel (lib/grammar/tableDeck.ts). A
// haladás a game_progress-be perzisztál, ${topic}:tabledeck kulccsal, ugyanaz
// a game_id (GRAMMAR_PROGRESS_KEY), mint a lecke-pontszámoké.
//
// FB375 (PLAN-fb0923 6. lépés): tábla nélküli leckén a kártya-forrás a lecke
// saját szavai (wordCellsForLesson), nem a ragozási tábla; a scheduler és a
// képernyő ugyanaz, csak a promptBig szövege és a chip-felirat vált módonként.

const progressKeyFor = (topicId: string) => `${topicId}:tabledeck`;

type DeckMode = 'table' | 'word';

interface DeckItem {
  id: string;
  /** The Spanish word/form to type. */
  answer: string;
  /** The big prompt text: "person · verb" for a table cell, the English
   *  meaning for a word card. */
  promptBig: string;
  /** FB378: the cell's English prompt ("she spoke"), table cells only; when
   *  set, promptBig shows it (with `verb` as the infinitive underneath)
   *  instead of the bare person·verb prompt. */
  enPrompt?: string;
  /** The table cell's infinitive, shown under an enPrompt. */
  verb?: string;
}

export default function TableDeckScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();
  const router = useRouter();
  const { topic: topicId } = useLocalSearchParams<{ topic: string }>();

  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState<Level>('A1');
  const [strictAccents, setStrictAccents] = useState(false);
  // FB364 (PLAN-fb0923 5. lépés/D2): egy beállítás, két hely, lásd
  // lib/grammar/tableDeck.ts fejét.
  const [againDelaySec, setAgainDelaySec] = useState(DEFAULT_AGAIN_DELAY_SEC);
  const [mode, setMode] = useState<DeckMode>('table');
  const [items, setItems] = useState<DeckItem[]>([]);
  const [deck, setDeck] = useState<DeckState>({ cells: [], resetCount: 0, shuffled: false });
  const [typed, setTyped] = useState('');
  const [checked, setChecked] = useState<{ correct: boolean } | null>(null);
  const [dockH, setDockH] = useState(DOCK_RESERVE);
  const { dockLift } = useDockLift();
  // React Compiler purity rule: Date.now() may not be called during render
  // (lib/grammar/tableDeck.ts's nextCellId needs "now" to pick the due
  // cell), so it lives in state, refreshed right after every action that can
  // change which cell is due (load, a check/next round, Start again).
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    const db = getDb();
    const id = String(topicId);
    const lesson = lessonFor('es', id);
    const tableCells = tableCellsForLesson(lesson);
    // FB375: table cells win where they exist (unchanged behavior); a
    // table-less lesson falls back to its own word-deck.
    const deckMode: DeckMode = tableCells.length > 0 ? 'table' : 'word';
    const itemList: DeckItem[] =
      deckMode === 'table'
        ? tableCells.map((c) => ({
            id: c.id,
            answer: c.answer,
            promptBig: c.enPrompt ?? `${c.person} · ${c.verb}`,
            enPrompt: c.enPrompt,
            verb: c.verb,
          }))
        : wordCellsForLesson(lesson).map((c) => ({ id: c.id, answer: c.es, promptBig: c.en }));
    const strict = await db.getStrictAccents();
    const delaySec = await db.getAgainDelaySec();
    const levelData = await db.getLevel();
    const rows = await db.getGameProgress(GRAMMAR_PROGRESS_KEY);
    const saved = rows.find((r) => r.itemId === progressKeyFor(id));
    const persisted = saved?.data as DeckState | undefined;
    setLevel((levelData.level as Level) ?? 'A1');
    setStrictAccents(strict);
    setAgainDelaySec(delaySec);
    setMode(deckMode);
    setItems(itemList);
    setDeck(mergeDeckState(itemList, id, persisted));
    setTyped('');
    setChecked(null);
    setNow(Date.now());
    setLoading(false);
    // setTyped is listed because the React Compiler infers it as a
    // dependency of this async callback (the input's onChangeText={setTyped}
    // below makes it "reactive"; see the identical PLAN-play 12. lépés note
    // in app/(tabs)/index.tsx's own `load`). It is stable, so nothing
    // changes at runtime, but leaving it out counts as broken memoization.
  }, [topicId, setTyped]);

  useLoadOnMount(load);

  const persist = (next: DeckState) => {
    getDb().setGameProgress(GRAMMAR_PROGRESS_KEY, progressKeyFor(String(topicId)), 'progress', next).catch(() => {});
  };

  const entry = syllabusTopic(String(topicId));
  const lessonTitle = entry?.title.en ?? String(topicId);

  const currentId = nextCellId(deck, now);
  const current = currentId ? items.find((c) => c.id === currentId) : undefined;
  const complete = items.length > 0 && !current;

  const handleCheck = () => {
    if (!current) return;
    const correct = typed.trim().length > 0 && strictAnswerMatch(typed, current.answer, { strictAccents, lang: 'es' });
    setChecked({ correct });
    speak(current.answer, speechLang('es'));
  };

  const handleNext = () => {
    if (!current || !checked) return;
    const nowMs = Date.now();
    const next = answerCell(deck, current.id, checked.correct, nowMs, againDelaySec * 1000);
    setDeck(next);
    persist(next);
    setTyped('');
    setChecked(null);
    setNow(nowMs);
  };

  const handleStartAgain = () => {
    const fresh = resetDeckInOrder(items);
    setDeck(fresh);
    persist(fresh);
    setTyped('');
    setChecked(null);
    setNow(Date.now());
  };

  // FB389: "Harder: shuffled" - all cells again, but shuffled this time
  // (resetDeckInOrder above is the plain restart, in the deck's own order).
  const handleHarder = () => {
    const fresh = resetDeckShuffled(items, String(topicId), deck.resetCount);
    setDeck(fresh);
    persist(fresh);
    setTyped('');
    setChecked(null);
    setNow(Date.now());
  };

  const header = (
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} hitSlop={12}>
        <Text style={[styles.back, { color: colors.text }]}>←</Text>
      </Pressable>
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
        {lessonTitle}
      </Text>
      <View style={[styles.progressChip, { backgroundColor: colors.tint }]}>
        <Text style={styles.progressChipText}>{s.tableDeck.progress(doneCount(deck), items.length)}</Text>
      </View>
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

  if (complete) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {header}
        <View style={[styles.progressTrack, { backgroundColor: colors.card }]}>
          <View style={[styles.progressFill, { backgroundColor: '#22C55E', width: `${pct}%` }]} />
        </View>
        <View style={styles.doneBody}>
          <Text style={styles.doneEmoji}>🎉</Text>
          <Text style={[styles.doneTitle, { color: colors.text }]}>{s.tableDeck.completeTitle(items.length)}</Text>
          <Pressable testID="tabledeck-start-again" style={[styles.btn, { backgroundColor: colors.tint }]} onPress={handleStartAgain}>
            <Text style={styles.btnTextOnTint}>{s.tableDeck.startAgain}</Text>
          </Pressable>
          {/* FB389: same pill shape/size as "Start again" (outline instead
              of filled), so the two options read as equally-weighted choices. */}
          <Pressable testID="tabledeck-harder" style={[styles.btn, styles.btnOutline, { borderColor: colors.tint }]} onPress={handleHarder}>
            <Text style={[styles.btnTextOnTint, { color: colors.tint }]}>{s.tableDeck.harder}</Text>
          </Pressable>
          <Pressable style={styles.ghostBtn} onPress={() => router.back()}>
            <Text style={[styles.ghostBtnText, { color: colors.tabIconDefault }]}>{s.tableDeck.backToLesson}</Text>
          </Pressable>
        </View>
        <FeedbackButton level={level} languagePair="en→es" currentCard={`grammar:${topicId}:tabledeck`} />
      </View>
    );
  }

  if (!current) {
    // No conjugation table AND no word-deck cards for this lesson (direct
    // link / stale state).
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {header}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {header}
      <View style={[styles.progressTrack, { backgroundColor: colors.card }]}>
        <View style={[styles.progressFill, { backgroundColor: '#22C55E', width: `${pct}%` }]} />
      </View>

      <ScrollView
        style={styles.cardScroll}
        contentContainerStyle={[styles.cardScrollContent, { paddingBottom: 16 + dockH + dockLift }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <CardShell compact colors={colors} chip={mode === 'table' ? s.tableDeck.chip : s.tableDeck.wordChip} onPress={() => Keyboard.dismiss()}>
          <Text style={[styles.promptCaption, { color: colors.tabIconDefault }]}>
            {mode === 'table'
              ? current.enPrompt
                ? s.tableDeck.promptCaptionEn
                : s.tableDeck.promptCaption
              : s.tableDeck.wordPromptCaption}
          </Text>
          <Text style={[styles.promptBig, { color: colors.text }]}>{current.promptBig}</Text>
          {/* FB390: a meaning-table cell (lib/grammar/tableDeck.ts) has no
              infinitive to show underneath (verb: ''), so this caption stays
              hidden there instead of rendering an empty line. */}
          {current.enPrompt && current.verb ? (
            <Text style={[styles.promptInfinitive, { color: colors.tabIconDefault }]}>{current.verb}</Text>
          ) : null}

          <TextInput
            testID="tabledeck-input"
            style={[styles.input, { color: colors.text, borderColor: colors.tabIconDefault }]}
            value={typed}
            onChangeText={setTyped}
            onSubmitEditing={checked ? handleNext : handleCheck}
            editable={!checked}
            autoFocus
            {...answerInputProps}
          />

          {checked && (
            <View style={styles.resultSection}>
              {checked.correct ? (
                <Text style={styles.correctLine}>{`✓ ${current.answer}`}</Text>
              ) : (
                <>
                  <Text style={styles.diffLine}>
                    {charDiff(typed, current.answer, { case: true, accents: false }).map((d, i) => (
                      <Text key={i} style={d.missing ? styles.diffMissing : d.wrong ? styles.diffWrong : { color: colors.text }}>
                        {d.ch}
                      </Text>
                    ))}
                  </Text>
                  <View style={styles.frontRow}>
                    <Text style={[styles.correctAnswer, { color: colors.tint }]}>{current.answer}</Text>
                    <Pressable onPress={() => speak(current.answer, speechLang('es'))} style={styles.speakBtn}>
                      <Text style={styles.speakIcon}>🔊</Text>
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          )}
        </CardShell>
      </ScrollView>

      <DockedAction
        label={checked ? `${s.grammar.next} →` : `✓ ${s.card.check}`}
        onPress={checked ? handleNext : handleCheck}
        tone={checked ? 'next' : 'check'}
        bottom={dockLift}
        colors={colors}
        onHeight={setDockH}
      />

      <FeedbackButton
        level={level}
        languagePair="en→es"
        currentCard={`grammar:${topicId}:tabledeck:${current.id}`}
        bottomOffset={dockH + dockLift}
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
  progressChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  progressChipText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 16 },
  progressFill: { height: '100%', borderRadius: 3 },
  cardScroll: { flex: 1, width: '100%' },
  cardScrollContent: { flexGrow: 1, justifyContent: 'flex-start', paddingTop: 8 },
  promptCaption: { fontSize: 13, textAlign: 'center', marginBottom: 8 },
  promptBig: { fontSize: 32, fontWeight: '700', textAlign: 'center', marginBottom: 20 },
  // FB378: the infinitive under the English prompt, pulled up into promptBig's
  // bottom margin so the two read as one prompt block.
  promptInfinitive: { fontSize: 15, fontStyle: 'italic', textAlign: 'center', marginTop: -12, marginBottom: 12 },
  input: { width: '100%', borderWidth: 2, borderRadius: 12, padding: 14, fontSize: 18, textAlign: 'center' },
  resultSection: { alignItems: 'center', marginTop: 16 },
  correctLine: { fontSize: 22, fontWeight: '700', textAlign: 'center', color: '#22C55E' },
  diffLine: { fontSize: 20, fontWeight: '700', textAlign: 'center', letterSpacing: 1, marginBottom: 6 },
  diffWrong: { backgroundColor: '#EF4444', color: '#FFFFFF' },
  diffMissing: { backgroundColor: '#EAB308', color: '#FFFFFF', textDecorationLine: 'underline' },
  frontRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 8 },
  correctAnswer: { flex: 1, flexShrink: 1, fontSize: 22, fontWeight: '600', textAlign: 'center' },
  speakBtn: { padding: 4, flexShrink: 0 },
  speakIcon: { fontSize: 22 },
  doneBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
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
  // FB389: "Harder: shuffled" pill, same size as `btn`, outline instead of filled.
  btnOutline: { backgroundColor: 'transparent', borderWidth: 2 },
  ghostBtn: { marginTop: 4, padding: 8 },
  ghostBtnText: { fontSize: 14 },
});
