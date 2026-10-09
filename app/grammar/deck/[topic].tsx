import { useCallback, useState } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '@/components/KText';
import { useLocalSearchParams, useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { brutalHeaderRowStyle } from '@/lib/brutalHeader';
import { BrutalBackButton, BrutalButton, Sticker, SegmentBar, brutalInputStyle, segmentsFilled } from '@/components/grammar/Brutal';
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
import FitText from '@/components/FitText';
import SpeakButton from '@/components/SpeakButton';
import { isInfinitive } from '@/lib/grammar/tableShape';
import { useDiffStyles } from '@/lib/useDiffStyles';
import CardShell from '@/components/learn/CardShell';
import DockedAction, { DOCK_RESERVE, FAB_CLEARANCE } from '@/components/learn/DockedAction';
import { useDockLift } from '@/components/learn/useDockLift';

// A lecke ragozó
// tábláinak celláit gyakorolja, a PCIC-kártya felületén (CardShell,
// DockedAction), Anki-szerű ütemezéssel (lib/grammar/tableDeck.ts). A
// haladás a game_progress-be perzisztál, ${topic}:tabledeck kulccsal, ugyanaz
// a game_id (GRAMMAR_PROGRESS_KEY), mint a lecke-pontszámoké.
//
// tábla nélküli leckén a kártya-forrás a lecke
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
  /** the cell's English prompt ("she spoke"), table cells only; when
   *  set, promptBig shows it (with `verb` as the infinitive underneath)
   *  instead of the bare person·verb prompt. */
  enPrompt?: string;
  /** The table cell's infinitive, shown under an enPrompt. */
  verb?: string;
  /** a ragozó cella infinitivusa rejtett, a súgó-gombra (vagy
   *  a Check után) látszik; oszlop-fejlécnél (személy-tábla) és szó-paklinál nincs. */
  hintVerb?: boolean;
}

export default function TableDeckScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const diff = useDiffStyles();
  const s = t();
  const router = useRouter();
  const { topic: topicId } = useLocalSearchParams<{ topic: string }>();

  const [loading, setLoading] = useState(true);
  const [learnedLang, setLearnedLang] = useState('es');
  const [level, setLevel] = useState<Level>('A1');
  const [strictAccents, setStrictAccents] = useState(false);
  // egy beállítás, két hely, lásd
  // lib/grammar/tableDeck.ts fejét.
  const [againDelaySec, setAgainDelaySec] = useState(DEFAULT_AGAIN_DELAY_SEC);
  const [mode, setMode] = useState<DeckMode>('table');
  const [items, setItems] = useState<DeckItem[]>([]);
  const [deck, setDeck] = useState<DeckState>({ cells: [], resetCount: 0, shuffled: false });
  const [typed, setTyped] = useState('');
  const [checked, setChecked] = useState<{ correct: boolean } | null>(null);
  // annak a cellának az id-je, amihez a súgó-gombot megnyomták
  // (kártyaváltáskor levezetve "nincs megnyomva", nincs reset-effekt).
  const [hintFor, setHintFor] = useState<string | null>(null);
  // a beviteli mező minden új cellánál újra mountol
  // (a `key` ezt a számlálót tartalmazza), különben az `autoFocus` csak az első
  // cellánál fut, és a Check után letiltott (`editable={false}`), majd újra
  // engedélyezett natív mezőn Next után nem jön fel a billentyűzet. Ugyanaz az
  // ok és javítás, mint a PCIC-kártyán (app/(tabs)/index.tsx cardSeq).
  const [cellSeq, setCellSeq] = useState(0);
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
    const onboarding = await db.getOnboarding();
    const target = onboarding?.target ?? 'es';
    setLearnedLang(target);
    const lesson = lessonFor(target, id);
    const tableCells = tableCellsForLesson(lesson);
    // table cells win where they exist (unchanged behavior); a
    // table-less lesson falls back to its own word-deck.
    const deckMode: DeckMode = tableCells.length > 0 ? 'table' : 'word';
    const itemList: DeckItem[] =
      deckMode === 'table'
        ? tableCells.map((c) => ({
            id: c.id,
            answer: c.answer,
            // a rejtett infinitivus nincs a promptban (súgó-gomb mutatja).
            promptBig: c.enPrompt ?? (isInfinitive(c.verb) ? c.person : `${c.person} · ${c.verb}`),
            enPrompt: c.enPrompt,
            verb: c.verb,
            hintVerb: isInfinitive(c.verb),
          }))
        : // es→en irányban a kérdés a spanyol szó, a válasz az angol szó.
          wordCellsForLesson(lesson, target).map((c) =>
            target === 'en' ? { id: c.id, answer: c.en, promptBig: c.es } : { id: c.id, answer: c.es, promptBig: c.en }
          );
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
    // below makes it "reactive"; see the identical note
    // in app/(tabs)/index.tsx's own `load`). It is stable, so nothing
    // changes at runtime, but leaving it out counts as broken memoization.
  }, [topicId, setTyped]);

  useLoadOnMount(load);

  const persist = (next: DeckState) => {
    getDb().setGameProgress(GRAMMAR_PROGRESS_KEY, progressKeyFor(String(topicId)), 'progress', next).catch(() => {});
  };

  const entry = syllabusTopic(String(topicId), learnedLang);
  // es→en irányban (spanyol felület) a cím a felület nyelvén, nem mindig angolul.
  const lessonTitle = entry?.title[learnedLang === 'en' ? 'es' : 'en'] ?? entry?.title.en ?? String(topicId);

  // A FeedbackButton párcímkéje az aktív iránnyal (en→es vagy es→en).
  const deckPair = learnedLang === 'en' ? 'es→en' : 'en→es';

  const currentId = nextCellId(deck, now);
  const current = currentId ? items.find((c) => c.id === currentId) : undefined;
  const complete = items.length > 0 && !current;

  const handleCheck = () => {
    if (!current) return;
    const correct = typed.trim().length > 0 && strictAnswerMatch(typed, current.answer, { strictAccents, lang: learnedLang });
    setChecked({ correct });
    speak(current.answer, speechLang(learnedLang));
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
    setCellSeq((n) => n + 1);
  };

  const handleStartAgain = () => {
    const fresh = resetDeckInOrder(items);
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
    setDeck(fresh);
    persist(fresh);
    setTyped('');
    setChecked(null);
    setNow(Date.now());
  };

  // brutalista palettán vissza-doboz, nagybetűs cím, a haladás matrica.
  const header = (
    <View style={[styles.header, brutalHeaderRowStyle(g)]}>
      {g.brutal ? (
        <BrutalBackButton testID="tabledeck-back" onPress={() => router.back()} />
      ) : (
      <Pressable onPress={() => router.back()} hitSlop={12}>
        <Text style={[styles.back, { color: colors.text }]}>←</Text>
      </Pressable>
      )}
      <FitText variant="title" base={17} maxLines={2} reserve={g.brutal ? 190 : 150} caps={g.brutal} style={[styles.title, { color: colors.text }, g.brutal && styles.brutalTitle]}>
        {lessonTitle}
      </FitText>
      {g.brutal ? (
        <Sticker label={s.tableDeck.progress(doneCount(deck), items.length)} fill="a" rotate={4} />
      ) : (
      <View style={[styles.progressChip, { backgroundColor: colors.tint }]}>
        <Text style={styles.progressChipText}>{s.tableDeck.progress(doneCount(deck), items.length)}</Text>
      </View>
      )}
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

  const progressBar = g.brutal ? (
    <SegmentBar testID="tabledeck-segments" filled={segmentsFilled(pct, 8)} segments={8} style={styles.brutalBar} />
  ) : (
    <View style={[styles.progressTrack, { backgroundColor: colors.card }]}>
      <View style={[styles.progressFill, { backgroundColor: '#22C55E', width: `${pct}%` }]} />
    </View>
  );

  if (complete) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {header}
        {progressBar}
        <View style={styles.doneBody}>
          <Text style={styles.doneEmoji}>🎉</Text>
          <Text variant="title" style={[styles.doneTitle, { color: colors.text }]}>{s.tableDeck.completeTitle(items.length)}</Text>
          {g.brutal ? (
            <BrutalButton testID="tabledeck-start-again" fill="a" label={s.tableDeck.startAgain} onPress={handleStartAgain} style={styles.brutalBtn} />
          ) : (
          <Pressable testID="tabledeck-start-again" style={[styles.btn, { backgroundColor: colors.tint }]} onPress={handleStartAgain}>
            <Text style={styles.btnTextOnTint}>{s.tableDeck.startAgain}</Text>
          </Pressable>
          )}
          {/* same pill shape/size as "Start again" (outline instead
              of filled), so the two options read as equally-weighted choices. */}
          {g.brutal ? (
            <BrutalButton testID="tabledeck-harder" fill="paper" label={s.tableDeck.harder} onPress={handleHarder} style={styles.brutalBtn} />
          ) : (
          <Pressable testID="tabledeck-harder" style={[styles.btn, styles.btnOutline, { borderColor: colors.tint }]} onPress={handleHarder}>
            <Text style={[styles.btnTextOnTint, { color: colors.tint }]}>{s.tableDeck.harder}</Text>
          </Pressable>
          )}
          <Pressable style={styles.ghostBtn} onPress={() => router.back()}>
            <Text style={[styles.ghostBtnText, { color: colors.tabIconDefault }]}>{s.tableDeck.backToLesson}</Text>
          </Pressable>
        </View>
        <FeedbackButton level={level} languagePair={deckPair} currentCard={`grammar:${topicId}:tabledeck`} />
      </View>
    );
  }

  if (!current) {
    // No conjugation table AND no word-deck cards for this lesson (direct
    // link / stale state).
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {header}
        {/* az üres pakli lapján is ott a 💬. */}
        <FeedbackButton level={level} languagePair={deckPair} currentCard={`grammar:${topicId}:tabledeck:empty`} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {header}
      {progressBar}

      <ScrollView
        style={styles.cardScroll}
        contentContainerStyle={[styles.cardScrollContent, { paddingBottom: FAB_CLEARANCE + dockH + dockLift }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <CardShell compact colors={colors} chip={mode === 'table' ? s.tableDeck.chip : s.tableDeck.wordChip} onPress={() => Keyboard.dismiss()}>
          <Text style={[styles.promptCaption, { color: colors.tabIconDefault }]}>
            {mode === 'table'
              ? current.enPrompt
                ? s.tableDeck.promptCaptionEn
                : s.tableDeck.promptCaption
              : learnedLang === 'en'
                ? s.tableDeck.wordPromptCaptionEn
                : s.tableDeck.wordPromptCaption}
          </Text>
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
            <Text style={[styles.promptInfinitive, { color: colors.tabIconDefault }]}>{current.verb}</Text>
          ) : null}

          <TextInput
            key={`deck-in-${current.id}-${cellSeq}`}
            testID="tabledeck-input"
            style={[styles.input, { color: colors.text, borderColor: colors.tabIconDefault }, g.brutal && brutalInputStyle(g)]}
            value={typed}
            onChangeText={setTyped}
            onSubmitEditing={checked ? handleNext : handleCheck}
            editable={!checked}
            autoFocus
            placeholder={s.card.typeIn(learnedLang)}
            placeholderTextColor={colors.tabIconDefault}
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
                      <Text key={i} style={d.missing ? diff.missing : d.wrong ? diff.wrong : { color: colors.text }}>
                        {d.ch}
                      </Text>
                    ))}
                  </Text>
                  <View style={styles.frontRow}>
                    <Text variant="word" style={[styles.correctAnswer, { color: colors.tint }]}>{current.answer}</Text>
                    <SpeakButton onPress={() => speak(current.answer, speechLang(learnedLang))} style={styles.speakBtn} iconStyle={styles.speakIcon} />
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
        languagePair={deckPair}
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
  brutalTitle: { textTransform: 'uppercase', fontWeight: '500' },
  brutalBar: { marginBottom: 16 },
  brutalBtn: { alignSelf: 'stretch', marginTop: 10 },
  progressChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  progressChipText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 16 },
  progressFill: { height: '100%', borderRadius: 3 },
  cardScroll: { flex: 1, width: '100%' },
  cardScrollContent: { flexGrow: 1, justifyContent: 'flex-start', paddingTop: 8 },
  promptCaption: { fontSize: 13, textAlign: 'center', marginBottom: 8 },
  promptBig: { fontSize: 32, fontWeight: '700', textAlign: 'center', marginBottom: 20 },
  // the infinitive under the English prompt, pulled up into promptBig's
  // bottom margin so the two read as one prompt block.
  promptInfinitive: { fontSize: 15, fontStyle: 'italic', textAlign: 'center', marginTop: -12, marginBottom: 12 },
  // A rejtett infinitivus súgó-gombja: középen a prompt alatt.
  hintBtn: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 10, marginTop: -8, marginBottom: 12 },
  hintBtnBrutal: { alignSelf: 'center', marginTop: -8, marginBottom: 12 },
  hintLabel: { fontSize: 14, fontWeight: '600' },
  input: { width: '100%', borderWidth: 2, borderRadius: 12, padding: 14, fontSize: 18, textAlign: 'center' },
  resultSection: { alignItems: 'center', marginTop: 16 },
  correctLine: { fontSize: 22, fontWeight: '700', textAlign: 'center', color: '#22C55E' },
  diffLine: { fontSize: 20, fontWeight: '700', textAlign: 'center', letterSpacing: 1, marginBottom: 6 },
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
  // "Harder: shuffled" pill, same size as `btn`, outline instead of filled.
  btnOutline: { backgroundColor: 'transparent', borderWidth: 2 },
  ghostBtn: { marginTop: 4, padding: 8 },
  ghostBtnText: { fontSize: 14 },
});
