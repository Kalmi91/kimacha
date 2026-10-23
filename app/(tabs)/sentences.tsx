import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { Text } from '@/components/KText';
import Colors from '@/constants/Colors';
import EasySentenceCard from '@/components/EasySentenceCard';
import ScreenFeedback from '@/lib/screenFeedback';
import TypedSentenceCard from '@/components/TypedSentenceCard';
import { ActionButton, ProgressBar } from '@/components/grammar/Themed';
import { DOCK_RESERVE } from '@/components/learn/DockedAction';
import { useDockLift } from '@/components/learn/useDockLift';
import LevelCounter from '@/components/practice/LevelCounter';
import { SkinBackdrop, SkinHeader } from '@/components/skins/Slots';
import { PCIC_LEVELS, findPcicItem, levelOfItem, pcicItemsForLevel, type PcicTarget } from '@/data/pcic';
import { getBeta, loadBeta, useBeta } from '@/lib/beta';
import { getDb } from '@/lib/database';
import { useLearner } from '@/lib/learner';
import { GRAMMAR_PROGRESS_KEY, doneGrammarTopicProgress } from '@/lib/grammar/syllabus';
import { t } from '@/lib/i18n';
import { pairOf } from '@/lib/languagePair';
import { speechLang } from '@/lib/languages';
import { countLearningToday } from '@/lib/learningDay';
import { resolvedTensesFromLessons } from '@/lib/knownSentence';
import { nearMissDistractors } from '@/lib/distractors';
import { dropOrphanCards } from '@/lib/pcicSession';
import { tileWords } from '@/lib/sentenceCards';
import { pickSentences } from '@/lib/sentencePick';
import {
  addHinted,
  answerStep,
  clearSentenceRound,
  currentEntry,
  currentStep,
  isRoundFor,
  loadSentenceRound,
  roundProgress,
  roundSentences,
  saveSentenceRound,
  sentenceNumber,
  startRound,
  type SentenceRound,
} from '@/lib/sentenceRound';
import { hintPieces, type HintPiece } from '@/lib/sentenceHint';
import { mistakeTrapWords, pickMistakeEntry, recordMistakeBuild, withMistakeStep } from '@/lib/sentenceMistakes';
import type { RoundStep } from '@/lib/sentenceSteps';
import { SENTENCE_ROUND_SIZE, buildSentenceQueue, recordTypedWords, sentenceKey, type SentenceEntry } from '@/lib/sentenceTab';
import { gradeTypedWords } from '@/lib/sentenceTyping';
import { useTheme } from '@/lib/ThemeContext';
import { localDateString } from '@/lib/usageStats';
import { useScreenLoad } from '@/lib/useScreenLoad';
import { useSingleFlight } from '@/lib/useSingleFlight';

// Beta tab (Settings -> Beta -> Sentences tab), spec HAROM-JATEK.md 3, FB524. A round = 5 sentences (lib/sentencePick.ts picks
// them); each runs through its steps in order (lib/sentenceSteps.ts): the parts of a split sentence built from tiles (the
// English part into the Spanish part), the Spanish sentence heard and typed, the whole sentence built, the whole sentence typed
// from the English. Only the last, typing step credits (lib/sentenceTyping.ts, lib/sentenceTab.ts recordTypedWords): a learned
// word typed right gets one half even if the rest is wrong, a due word typed wrong counts as a wrong typed answer. A wrong step
// goes to the end of the round (the typing step is done either way). lib/sentenceRound.ts holds the round's state and its
// save: it is saved on every step, so leaving the tab or the app and coming back continues it (same day). The `focus` route
// parameter (card ids, comma separated) puts the sentences with those words first. The cards are the Words tab's former
// sentence cards.

// The tile step: a part of a sentence or the whole one. The decoys are picked once when the step mounts (a retry remounts it:
// key). A mistake step is a sentence from the learner's own mistakes (its decoys come from the faulty sentence). `hints`: the
// tappable words of the English prompt (lib/sentenceHint.ts); a looked-at word reports its cards through `onHint`.
function BuildStep({ entry, target, step, hints, onHint, onResult }: { entry: SentenceEntry; target: PcicTarget; step: RoundStep; hints: HintPiece[] | null; onHint: (ids: string[]) => void; onResult: (correct: boolean) => void }) {
  const [tiles] = useState(() => {
    // A part step builds one part (its English is the prompt); every other step builds the whole sentence.
    const chunk = step.kind === 'chunk' && step.chunk !== undefined ? entry.chunks?.[step.chunk] : undefined;
    const targetWords = tileWords(chunk ? chunk.target : entry.target);
    const level = levelOfItem(entry.itemId);
    const vocab = (level ? pcicItemsForLevel(level) : PCIC_LEVELS.flatMap((l) => pcicItemsForLevel(l))).map((i) =>
      (target === 'es' ? i.es : i.en).split(' / ')[0],
    );
    // A mistake step's decoys are the words of the faulty sentence the learner wrote (lib/sentenceMistakes.ts).
    const trapWords = step.kind === 'mistake' && entry.mistake ? mistakeTrapWords(targetWords, entry.mistake.wrong, vocab, target) : nearMissDistractors(targetWords, vocab, target);
    return { source: chunk ? chunk.source : entry.source, targetWords, trapWords };
  });
  return (
    <EasySentenceCard
      sourceSentence={tiles.source}
      targetWords={tiles.targetWords}
      trapWords={tiles.trapWords}
      speechLocale={speechLang(target)}
      sourceSpeechLocale={speechLang(target === 'es' ? 'en' : 'es')}
      onResult={onResult}
      gradeButtons
      sourceHints={hints}
      onSourceHint={onHint}
    />
  );
}

// The label of a step ("Build part 1 of 2"): the screen adds the sentence's place in front of it.
function stepLabel(step: RoundStep, entry: SentenceEntry, s: ReturnType<typeof t>): string {
  if (step.kind === 'chunk') return s.sentenceTab.stepChunk((step.chunk ?? 0) + 1, entry.chunks?.length ?? 1);
  if (step.kind === 'listen') return s.sentenceTab.stepListenType;
  if (step.kind === 'type') return s.sentenceTab.stepTypeWhole;
  return s.sentenceTab.stepBuildWhole;
}

export default function SentencesScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();
  // beta: xpV2, each word's half of a typed sentence earns XP; off = no XP, the old behavior.
  const xpV2 = useBeta('xpV2');
  // beta: sentenceMistakes, one build is a sentence from "My mistakes", credited to that deck (lib/sentenceMistakes.ts).
  const mistakesBeta = useBeta('sentenceMistakes');
  // beta: sentenceHint, the English prompt's words can be tapped for the Spanish form; a looked-at word earns no credit this round.
  const hintBeta = useBeta('sentenceHint');
  // `focus` = card ids (comma separated): the sentences with those words come first (the Practice tab sends them here).
  const { focus } = useLocalSearchParams<{ focus?: string | string[] }>();
  const focusIds = (Array.isArray(focus) ? focus.join(',') : focus ?? '').split(',').map((id) => id.trim()).filter(Boolean);
  const focusKey = [...new Set(focusIds)].sort().join(',');

  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<PcicTarget>('es');
  const { strictAccents, refresh } = useLearner();
  // The round on screen (lib/sentenceRound.ts): its sentences, its steps, what is left to do and what is done.
  // null = no sentence to offer.
  const [round, setRound] = useState<SentenceRound | null>(null);
  // Bumps on every finished step, so a sentence that comes back gets fresh tiles and an empty input.
  const [seq, setSeq] = useState(0);
  // Bumps after every typed sentence is credited: the level counter on top reads the db again.
  const [creditSeq, setCreditSeq] = useState(0);
  // Sentences of the finished rounds since the app opened: left out of the next rounds, or a word that is still due
  // would bring the same sentences straight back.
  const doneKeys = useRef(new Set<string>());
  const runOnce = useSingleFlight();
  // The round on screen, for the focus effect (its state is stale in the callback).
  const roundRef = useRef<SentenceRound | null>(null);
  const [dockH, setDockH] = useState(DOCK_RESERVE);
  const { dockLift, kbHeight } = useDockLift();

  // `fresh`: a new round even if one is on screen (the "more" button).
  const load = useCallback(async (fresh = false) => {
    const db = getDb();
    // The learner store sets the deck's direction before the corpus is read (data/pcic.ts: the loaded deck follows the target).
    const { target: dir } = await refresh(['direction']);
    const today = localDateString();
    // A round on screen (running or finished) survives leaving the tab; a new day, another direction, another focus
    // or the "more" button replaces it.
    const shown = roundRef.current;
    if (!fresh && shown && shown.day === today && shown.target === dir && shown.focus === focusKey) {
      await refresh(['strictAccents']);
      setLoading(false);
      return;
    }
    // A round that was left (other tab, app closed) continues where it stopped, the same day, direction and focus.
    const saved = await loadSentenceRound(db);
    let next: SentenceRound | null;
    if (isRoundFor(saved, today, dir, focusKey)) {
      next = saved;
      // A sentence with every step done is done, even if the round goes on.
      for (const e of saved.entries) {
        if (saved.steps.filter((st) => st.itemId === e.itemId).every((st) => saved.done.includes(st.id))) doneKeys.current.add(sentenceKey(e));
      }
    } else {
      const cards = dropOrphanCards(await db.getPcicCards(), (id) => findPcicItem(id) !== undefined);
      const grammarRows = dir === 'es' ? await db.getGameProgress(GRAMMAR_PROGRESS_KEY) : [];
      const queue = buildSentenceQueue({
        target: dir,
        cards,
        tenses: resolvedTensesFromLessons(doneGrammarTopicProgress(dir, grammarRows).keys()),
        items: PCIC_LEVELS.flatMap((l) => pcicItemsForLevel(l)),
        findItem: findPcicItem,
        today,
        done: doneKeys.current,
        focus: new Set(focusKey.split(',').filter(Boolean)),
      });
      const picked = pickSentences(queue, dir, SENTENCE_ROUND_SIZE);
      // beta sentenceMistakes: one sentence is from the learner's mistake list (Spanish direction only; none = the round as picked).
      let entries = picked;
      await loadBeta();
      if (picked.length > 0 && dir === 'es' && getBeta('sentenceMistakes')) {
        const skip = new Set([...doneKeys.current, ...picked.map((e) => sentenceKey(e))]);
        entries = withMistakeStep(picked, await pickMistakeEntry(today, skip));
      }
      // beta sentenceListening: each sentence gets its listen-and-type step.
      next = entries.length > 0 ? startRound(entries, today, dir, focusKey, { listening: getBeta('sentenceListening') }) : null;
      // Saved at once (when there is a round): leaving before the first answer brings back the same sentences.
      if (next) await saveSentenceRound(db, next);
      else await clearSentenceRound(db);
    }
    setTarget(dir);
    await refresh(['strictAccents']);
    setRound(next);
    setSeq((n) => n + 1);
    setLoading(false);
  }, [focusKey, refresh]);

  useScreenLoad(load, { hasData: round !== null, setLoading });

  useEffect(() => {
    roundRef.current = round;
  }, [round]);

  const step = round ? currentStep(round) : undefined;
  const current = round ? currentEntry(round) : undefined;
  const { done, total } = round ? roundProgress(round) : { done: 0, total: 0 };
  // The tappable words of the prompt on screen (Spanish direction only; a part of a sentence and the listening step have none).
  const hints = hintBeta && target === 'es' && current && step && step.kind !== 'chunk' && step.kind !== 'listen' ? hintPieces(current) : null;

  // The new state is saved BEFORE the words are credited: a kill in between loses a credit, it never pays one twice.
  const keepRound = async (next: SentenceRound) => {
    if (next.phase === 'done') await clearSentenceRound(getDb());
    else await saveSentenceRound(getDb(), next);
  };

  // A word was looked at: its cards earn no half and no XP in this round (kept with the round, so a restart does not forget it).
  const onHint = (ids: string[]) => {
    const shown = roundRef.current ?? round;
    if (!shown) return;
    const next = addHinted(shown, ids);
    if (next === shown) return;
    roundRef.current = next;
    setRound(next);
    void saveSentenceRound(getDb(), next);
  };

  // The step on screen was answered. Only the typing step credits words; a mistake step is credited to the mistake deck.
  const onStepResult = async (correct: boolean, typed = '') => {
    if (!round) return;
    const stepNow = currentStep(round);
    const entry = currentEntry(round);
    if (!stepNow || !entry) return;
    await runOnce(async () => {
      const next = answerStep(round, correct);
      await keepRound(next);
      if (stepNow.kind === 'type') {
        // Credits word by word. "Knew it" on a sentence the check marked wrong makes every word right.
        let verdicts = gradeTypedWords(typed, entry, target, strictAccents);
        if (correct && verdicts.some((v) => !v.right)) verdicts = verdicts.map((v) => ({ ...v, right: true }));
        // A word that was looked at with a hint this round earns nothing (neither a half nor a step back).
        const hinted = new Set((roundRef.current ?? round).hinted ?? []);
        if (hinted.size > 0) verdicts = verdicts.filter((v) => !hinted.has(v.id));
        await recordTypedWords(verdicts, xpV2);
      } else if (stepNow.kind === 'mistake' && mistakesBeta) {
        // Credited to the mistake deck, as its Knew it / Didn't know: right = knew it, wrong = didn't know.
        await recordMistakeBuild(entry.itemId, correct, localDateString());
      }
      await countLearningToday();
      if (next.phase === 'done') for (const e of roundSentences(round)) doneKeys.current.add(sentenceKey(e));
      setRound(next);
      setSeq((n) => n + 1);
      if (stepNow.kind === 'type') setCreditSeq((n) => n + 1);
    });
  };

  const feedback = (
    <ScreenFeedback
      placement="header"
      level="-"
      languagePair={pairOf(target)}
      currentCard={current ? `sentences:${current.itemId}` : 'sentences-tab'}
    />
  );

  const header = (
    <SkinHeader>
      {/* No screen title: the tab navigator's header already says "Sentences" (a second one was a duplicate). */}
      <View style={styles.headerRow}>
        <LevelCounter refreshKey={creditSeq} />
        {total > 0 && (
          <Text style={[styles.progressText, { color: colors.tabIconDefault }]} testID="sentences-progress-text" accessibilityLabel={s.sentenceTab.progressA11y(done, total)}>
            {s.sentenceTab.progress(done, total)}
          </Text>
        )}
      </View>
      {total > 0 && (
        // One block per step while the round is short, so the bar and the "4 / 5" next to it count the same steps.
        <ProgressBar
          testID="sentences-progress"
          pct={(done / total) * 100}
          filled={total <= 12 ? done : undefined}
          segments={total <= 12 ? total : undefined}
          brutalStyle={styles.brutalProgress}
          trackStyle={styles.progressTrack}
          trackColor={colors.card}
          fillStyle={styles.progressFill}
          fillColor={colors.tint}
          trackProps={{
            testID: 'sentences-progress',
            accessibilityRole: 'progressbar',
            accessibilityLabel: s.sentenceTab.progressA11y(done, total),
            accessibilityValue: { min: 0, max: total, now: done },
          }}
        />
      )}
    </SkinHeader>
  );

  if (loading) {
    return (
      <View testID="sentences-screen" style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  // Nothing to offer: no sentence has only learned words yet.
  if (total === 0) {
    return (
      <View testID="sentences-screen" style={[styles.container, { backgroundColor: colors.background }]}>
        <SkinBackdrop />
        {header}
        <Text testID="sentences-empty" style={[styles.hint, { color: colors.tabIconDefault }]}>
          {s.sentenceTab.empty}
        </Text>
        {feedback}
      </View>
    );
  }

  // The round is over: every step of it is done.
  if (!round || !current || !step) {
    return (
      <View testID="sentences-screen" style={[styles.container, { backgroundColor: colors.background }]}>
        <SkinBackdrop />
        {header}
        <Text testID="sentences-round-done" style={[styles.hint, { color: colors.text }]}>
          {s.sentenceTab.roundDone(round ? roundSentences(round).length : 0)}
        </Text>
        <ActionButton
          testID="sentences-more"
          label={s.sentenceTab.more}
          fill="a"
          onPress={() => { setLoading(true); void load(true); }}
          brutalStyle={styles.moreBtn}
          classicStyle={[styles.moreBtn, styles.moreBtnClassic, { backgroundColor: colors.accent }]}
          classicTextStyle={[styles.moreBtnText, { color: colors.onTint }]}
        />
        {feedback}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      testID="sentences-screen"
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SkinBackdrop />
      {header}
      <Text testID="sentences-step" style={[styles.stepText, { color: colors.tabIconDefault }]}>
        {`${s.sentenceTab.sentenceOf(sentenceNumber(round), round.entries.length)} · ${stepLabel(step, current, s)}`}
      </Text>
      {step.kind === 'mistake' && (
        <Text testID="sentences-mistake-label" style={[styles.mistakeLabel, { color: colors.text }]}>
          {s.sentenceTab.fromMistakes}
        </Text>
      )}
      {step.kind === 'listen' || step.kind === 'type' ? (
        // The typing cards have their own scroller + the docked Check bar above the keyboard (no outer ScrollView).
        <TypedSentenceCard
          key={`${step.id}-${seq}`}
          sourceSentence={current.source}
          targetSentence={current.target}
          strictAccents={strictAccents}
          speechLocale={speechLang(target)}
          sourceSpeechLocale={speechLang(target === 'es' ? 'en' : 'es')}
          onResult={(correct, typed) => void onStepResult(correct, typed)}
          dockLift={dockLift}
          keyboardOpen={kbHeight > 0}
          dockH={dockH}
          onDockHeight={setDockH}
          gradeButtons
          sourceHints={hints}
          onSourceHint={onHint}
          listening={step.kind === 'listen'}
        />
      ) : (
        <ScrollView
          style={styles.cardScroll}
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <BuildStep key={`${step.id}-${seq}`} entry={current} target={target} step={step} hints={hints} onHint={onHint} onResult={(correct) => void onStepResult(correct)} />
        </ScrollView>
      )}
      {feedback}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  centered: { justifyContent: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  progressText: { fontSize: 16, fontWeight: '600' },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 16 },
  progressFill: { height: '100%', borderRadius: 3 },
  brutalProgress: { marginBottom: 16 },
  stepText: { fontSize: 14, fontWeight: '600', textAlign: 'center', marginBottom: 8 },
  mistakeLabel: { fontSize: 13, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  hint: { fontSize: 16, fontWeight: '500', marginTop: 12 },
  cardScroll: { flex: 1 },
  moreBtn: { alignSelf: 'stretch', marginTop: 24 },
  moreBtnClassic: { paddingVertical: 14, borderRadius: 24, alignItems: 'center' },
  moreBtnText: { fontSize: 16, fontWeight: '700' },
});
