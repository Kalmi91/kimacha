import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';

import { Text } from '@/components/KText';
import Colors from '@/constants/Colors';
import EasySentenceCard from '@/components/EasySentenceCard';
import FeedbackButton from '@/components/FeedbackModal';
import TypedSentenceCard from '@/components/TypedSentenceCard';
import { BrutalButton, SegmentBar } from '@/components/grammar/Brutal';
import { DOCK_RESERVE } from '@/components/learn/DockedAction';
import { useDockLift } from '@/components/learn/useDockLift';
import LevelCounter from '@/components/practice/LevelCounter';
import { SkinBackdrop, SkinHeader } from '@/components/skins/Slots';
import { PCIC_LEVELS, findPcicItem, levelOfItem, pcicItemsForLevel, setPcicTarget, type PcicTarget } from '@/data/pcic';
import { useBeta } from '@/lib/beta';
import { getDb } from '@/lib/database';
import { GRAMMAR_PROGRESS_KEY, doneGrammarTopicProgress } from '@/lib/grammar/syllabus';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import { speechLang } from '@/lib/languages';
import { resolvedTensesFromLessons } from '@/lib/knownSentence';
import { nearMissDistractors } from '@/lib/distractors';
import { dropOrphanCards } from '@/lib/pcicSession';
import { tileWords } from '@/lib/sentenceCards';
import { pickRound } from '@/lib/sentencePick';
import {
  answerBuild,
  answerType,
  buildNumber,
  clearSentenceRound,
  currentEntry,
  isRoundFor,
  loadSentenceRound,
  roundProgress,
  roundSentences,
  saveSentenceRound,
  startRound,
  type SentenceRound,
} from '@/lib/sentenceRound';
import { SENTENCE_ROUND_SIZE, buildSentenceQueue, recordTypedWords, sentenceKey, type SentenceEntry } from '@/lib/sentenceTab';
import { gradeTypedWords } from '@/lib/sentenceTyping';
import { useTheme } from '@/lib/ThemeContext';
import { localDateString } from '@/lib/usageStats';

// Beta tab (Settings -> Beta -> Sentences tab), spec HAROM-JATEK.md 3. A round = 4 sentences built from word tiles
// (near-miss decoys; a build credits nothing), then ONE other, shorter sentence typed (lib/sentencePick.ts picks both,
// lib/sentenceRound.ts: the round's state and its save). The typing credits word by word (lib/sentenceTyping.ts,
// lib/sentenceTab.ts recordTypedWords): a learned word typed right gets one half even if the rest is wrong, a due word
// typed wrong counts as a wrong typed answer. A wrong build sends the sentence to the end of the round. The round is
// saved on every step, so leaving the tab or the app and coming back continues it (same day). The `focus` route
// parameter (card ids, comma separated) puts the sentences with those words first. The cards are the Words tab's
// former sentence cards.

// The tile step; the decoys are picked once when the step mounts (a retry remounts it: key).
function BuildStep({ entry, target, onResult }: { entry: SentenceEntry; target: PcicTarget; onResult: (correct: boolean) => void }) {
  const [step] = useState(() => {
    const targetWords = tileWords(entry.target);
    const level = levelOfItem(entry.itemId);
    const vocab = (level ? pcicItemsForLevel(level) : PCIC_LEVELS.flatMap((l) => pcicItemsForLevel(l))).map((i) =>
      (target === 'es' ? i.es : i.en).split(' / ')[0],
    );
    return { targetWords, trapWords: nearMissDistractors(targetWords, vocab, target) };
  });
  return (
    <EasySentenceCard
      sourceSentence={entry.source}
      targetWords={step.targetWords}
      trapWords={step.trapWords}
      speechLocale={speechLang(target)}
      sourceSpeechLocale={speechLang(target === 'es' ? 'en' : 'es')}
      onResult={onResult}
      gradeButtons
    />
  );
}

export default function SentencesScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t();
  // beta: xpV2, each word's half of a typed sentence earns XP; off = no XP, the old behavior.
  const xpV2 = useBeta('xpV2');
  // `focus` = card ids (comma separated): the sentences with those words come first (the Practice tab sends them here).
  const { focus } = useLocalSearchParams<{ focus?: string | string[] }>();
  const focusIds = (Array.isArray(focus) ? focus.join(',') : focus ?? '').split(',').map((id) => id.trim()).filter(Boolean);
  const focusKey = [...new Set(focusIds)].sort().join(',');

  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<PcicTarget>('es');
  const [strictAccents, setStrictAccents] = useState(false);
  // The round on screen (lib/sentenceRound.ts): its sentences, what is left to build, what was built right, the typing.
  // null = no sentence to offer.
  const [round, setRound] = useState<SentenceRound | null>(null);
  // Bumps on every finished step, so a sentence that comes back gets fresh tiles and an empty input.
  const [seq, setSeq] = useState(0);
  // Bumps after every typed sentence is credited: the level counter on top reads the db again.
  const [creditSeq, setCreditSeq] = useState(0);
  // Sentences of the finished rounds since the app opened: left out of the next rounds, or a word that is still due
  // would bring the same sentences straight back.
  const doneKeys = useRef(new Set<string>());
  const busy = useRef(false);
  // The round on screen, for the focus effect (its state is stale in the callback).
  const roundRef = useRef<SentenceRound | null>(null);
  const [dockH, setDockH] = useState(DOCK_RESERVE);
  const { dockLift } = useDockLift();

  // `fresh`: a new round even if one is on screen (the "more" button).
  const load = useCallback(async (fresh = false) => {
    const db = getDb();
    const onboarding = await db.getOnboarding();
    const dir = (onboarding?.target as PcicTarget) ?? 'es';
    // Must come before the corpus is read (data/pcic.ts: the loaded deck follows the target).
    setPcicTarget(dir);
    const today = localDateString();
    // A round on screen (running or finished) survives leaving the tab; a new day, another direction, another focus
    // or the "more" button replaces it.
    const shown = roundRef.current;
    if (!fresh && shown && shown.day === today && shown.target === dir && shown.focus === focusKey) {
      setStrictAccents(await db.getStrictAccents());
      setLoading(false);
      return;
    }
    // A round that was left (other tab, app closed) continues where it stopped, the same day, direction and focus.
    const saved = await loadSentenceRound(db);
    let next: SentenceRound | null;
    if (isRoundFor(saved, today, dir, focusKey)) {
      next = saved;
      for (const e of saved.entries) if (saved.rated.includes(e.itemId)) doneKeys.current.add(sentenceKey(e));
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
      const pick = pickRound(queue, dir, SENTENCE_ROUND_SIZE);
      next = pick.typed ? startRound(pick.builds, pick.typed, today, dir, focusKey) : null;
      // Saved at once (when there is a round): leaving before the first answer brings back the same sentences.
      if (next) await saveSentenceRound(db, next);
      else await clearSentenceRound(db);
    }
    setTarget(dir);
    setStrictAccents(await db.getStrictAccents());
    setRound(next);
    setSeq((n) => n + 1);
    setLoading(false);
  }, [focusKey]);

  useFocusEffect(
    useCallback(() => {
      if (!roundRef.current) setLoading(true);
      void load();
    }, [load]),
  );

  useEffect(() => {
    roundRef.current = round;
  }, [round]);

  const current = round ? currentEntry(round) : undefined;
  const { done, total } = round ? roundProgress(round) : { done: 0, total: 0 };

  // The new state is saved BEFORE the words are credited: a kill in between loses a credit, it never pays one twice.
  const keepRound = async (next: SentenceRound) => {
    if (next.phase === 'done') await clearSentenceRound(getDb());
    else await saveSentenceRound(getDb(), next);
  };

  const onBuildResult = async (correct: boolean) => {
    if (busy.current || !round) return;
    busy.current = true;
    try {
      // A build credits nothing: right = the sentence is done, wrong = it goes to the end of the round.
      const next = answerBuild(round, correct);
      await keepRound(next);
      setRound(next);
      setSeq((n) => n + 1);
    } finally {
      busy.current = false;
    }
  };

  const onTypeResult = async (correct: boolean, typed: string) => {
    if (busy.current || !round) return;
    busy.current = true;
    try {
      // The typing ends the round and credits word by word. "Knew it" on a sentence the check marked wrong makes every word right.
      let verdicts = gradeTypedWords(typed, round.typed, target, strictAccents);
      if (correct && verdicts.some((v) => !v.right)) verdicts = verdicts.map((v) => ({ ...v, right: true }));
      const next = answerType(round);
      await keepRound(next);
      await recordTypedWords(verdicts, xpV2);
      for (const e of roundSentences(round)) doneKeys.current.add(sentenceKey(e));
      setRound(next);
      setSeq((n) => n + 1);
      setCreditSeq((n) => n + 1);
    } finally {
      busy.current = false;
    }
  };

  const feedback = (
    <FeedbackButton
      level="-"
      languagePair={target === 'es' ? 'en-es' : 'es-en'}
      currentCard={current ? `sentences:${current.itemId}` : 'sentences-tab'}
      bottomOffset={round?.phase === 'type' ? dockH + dockLift : undefined}
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
      {total > 0 &&
        (g.brutal ? (
          // One block per step, so the bar and the "4 / 5" next to it count the same steps.
          <SegmentBar testID="sentences-progress" filled={done} segments={total} style={styles.brutalProgress} />
        ) : (
          <View
            testID="sentences-progress"
            accessibilityRole="progressbar"
            accessibilityLabel={s.sentenceTab.progressA11y(done, total)}
            accessibilityValue={{ min: 0, max: total, now: done }}
            style={[styles.progressTrack, { backgroundColor: colors.card }]}
          >
            <View style={[styles.progressFill, { backgroundColor: colors.tint, width: `${(done / total) * 100}%` }]} />
          </View>
        ))}
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

  // The round is over: every sentence in it was built right and the picked one typed right.
  if (!round || !current) {
    return (
      <View testID="sentences-screen" style={[styles.container, { backgroundColor: colors.background }]}>
        <SkinBackdrop />
        {header}
        <Text testID="sentences-round-done" style={[styles.hint, { color: colors.text }]}>
          {s.sentenceTab.roundDone(round ? roundSentences(round).length : 0)}
        </Text>
        {g.brutal ? (
          <BrutalButton testID="sentences-more" label={s.sentenceTab.more} fill="a" onPress={() => { setLoading(true); void load(true); }} style={styles.moreBtn} />
        ) : (
          <Pressable
            testID="sentences-more"
            accessibilityRole="button"
            style={[styles.moreBtn, styles.moreBtnClassic, { backgroundColor: colors.accent }]}
            onPress={() => {
              setLoading(true);
              void load(true);
            }}
          >
            <Text style={[styles.moreBtnText, { color: colors.onTint }]}>{s.sentenceTab.more}</Text>
          </Pressable>
        )}
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
        {round.phase === 'build' ? s.sentenceTab.stepBuild(buildNumber(round), round.entries.length) : s.sentenceTab.stepType}
      </Text>
      {round.phase === 'build' ? (
        <ScrollView
          style={styles.cardScroll}
          contentContainerStyle={{ paddingBottom: g.brutal ? 100 : 24 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <BuildStep key={`build-${current.itemId}-${seq}`} entry={current} target={target} onResult={(correct) => void onBuildResult(correct)} />
        </ScrollView>
      ) : (
        // The typing card has its own scroller + the docked Check bar above the keyboard (no outer ScrollView).
        <TypedSentenceCard
          key={`type-${current.itemId}-${seq}`}
          sourceSentence={current.source}
          targetSentence={current.target}
          strictAccents={strictAccents}
          speechLocale={speechLang(target)}
          sourceSpeechLocale={speechLang(target === 'es' ? 'en' : 'es')}
          onResult={(correct, typed) => void onTypeResult(correct, typed)}
          dockLift={dockLift}
          dockH={dockH}
          onDockHeight={setDockH}
          gradeButtons
        />
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
  hint: { fontSize: 16, fontWeight: '500', marginTop: 12 },
  cardScroll: { flex: 1 },
  moreBtn: { alignSelf: 'stretch', marginTop: 24 },
  moreBtnClassic: { paddingVertical: 14, borderRadius: 24, alignItems: 'center' },
  moreBtnText: { fontSize: 16, fontWeight: '700' },
});
