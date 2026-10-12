import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Text } from '@/components/KText';
import Colors from '@/constants/Colors';
import EasySentenceCard from '@/components/EasySentenceCard';
import TypedSentenceCard from '@/components/TypedSentenceCard';
import { BrutalButton, SegmentBar, segmentsFilled } from '@/components/grammar/Brutal';
import { DOCK_RESERVE } from '@/components/learn/DockedAction';
import { useDockLift } from '@/components/learn/useDockLift';
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
import {
  SENTENCE_ROUND_SIZE,
  afterSentence,
  buildSentenceQueue,
  recordSentenceHalves,
  sentenceKey,
  type SentenceEntry,
} from '@/lib/sentenceTab';
import { useTheme } from '@/lib/ThemeContext';
import { localDateString } from '@/lib/usageStats';

// Beta tab (Settings -> Beta -> Sentences tab), spec HAROM-JATEK.md 3. One sentence = two steps on the
// same sentence: build it from word tiles (near-miss decoys), then type it. Both right = the sentence is done and
// every learned word in it gets one half (lib/sentenceTab.ts recordSentenceHalves). A wrong step sends the
// sentence to the end of the round. The cards are the Words tab's former sentence cards.

type Phase = 'build' | 'type';

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
  // beta: xpV2, each word's half of a right sentence earns XP; off = no XP, the old behavior.
  const xpV2 = useBeta('xpV2');

  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<PcicTarget>('es');
  const [strictAccents, setStrictAccents] = useState(false);
  const [queue, setQueue] = useState<SentenceEntry[]>([]);
  // This round: how many sentences it started with and how many are done (the progress).
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(0);
  const [phase, setPhase] = useState<Phase>('build');
  // Bumps on every finished step, so a sentence that comes back gets fresh tiles and an empty input.
  const [seq, setSeq] = useState(0);
  // Sentences finished (right) since the app opened: left out of the next rounds, or a word that is still due would
  // bring the same sentence straight back.
  const doneKeys = useRef(new Set<string>());
  const busy = useRef(false);
  const [dockH, setDockH] = useState(DOCK_RESERVE);
  const { dockLift } = useDockLift();

  const load = useCallback(async () => {
    const db = getDb();
    const onboarding = await db.getOnboarding();
    const dir = (onboarding?.target as PcicTarget) ?? 'es';
    // Must come before the corpus is read (data/pcic.ts: the loaded deck follows the target).
    setPcicTarget(dir);
    const today = localDateString();
    const cards = dropOrphanCards(await db.getPcicCards(), (id) => findPcicItem(id) !== undefined);
    const grammarRows = dir === 'es' ? await db.getGameProgress(GRAMMAR_PROGRESS_KEY) : [];
    const round = buildSentenceQueue({
      target: dir,
      cards,
      tenses: resolvedTensesFromLessons(doneGrammarTopicProgress(dir, grammarRows).keys()),
      items: PCIC_LEVELS.flatMap((l) => pcicItemsForLevel(l)),
      findItem: findPcicItem,
      today,
      done: doneKeys.current,
    }).slice(0, SENTENCE_ROUND_SIZE);
    setTarget(dir);
    setStrictAccents(await db.getStrictAccents());
    setQueue(round);
    setTotal(round.length);
    setDone(0);
    setPhase('build');
    setSeq((n) => n + 1);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load]),
  );

  const current = queue[0];

  const onBuildResult = (correct: boolean) => {
    if (correct) {
      setPhase('type');
      return;
    }
    // A wrong build ends the sentence for now (the typing step would only copy the answer shown): it comes back later.
    setQueue((q) => afterSentence(q, false));
    setSeq((n) => n + 1);
  };

  const onTypeResult = async (correct: boolean) => {
    if (busy.current || !current) return;
    busy.current = true;
    try {
      if (correct) {
        await recordSentenceHalves(current.wordIds, undefined, xpV2);
        doneKeys.current.add(sentenceKey(current));
        setDone((n) => n + 1);
      }
      // A wrong typing sends no result to the words (no step back from this tab), the sentence just comes back later.
      setQueue((q) => afterSentence(q, correct));
      setPhase('build');
      setSeq((n) => n + 1);
    } finally {
      busy.current = false;
    }
  };

  const header = (
    <SkinHeader>
      <View style={styles.headerRow}>
        <Text variant="title" accessibilityRole="header" style={[styles.title, { color: colors.text }, g.brutal && styles.brutalTitle]}>
          {s.tabs.sentences}
        </Text>
        {total > 0 && (
          <Text style={[styles.progressText, { color: colors.tabIconDefault }]} testID="sentences-progress-text" accessibilityLabel={s.sentenceTab.progressA11y(done, total)}>
            {s.sentenceTab.progress(done, total)}
          </Text>
        )}
      </View>
      {total > 0 &&
        (g.brutal ? (
          <SegmentBar testID="sentences-progress" filled={segmentsFilled((done / total) * 100, 8)} segments={8} style={styles.brutalProgress} />
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
      </View>
    );
  }

  // The round is over: every sentence in it was built and typed right.
  if (!current) {
    return (
      <View testID="sentences-screen" style={[styles.container, { backgroundColor: colors.background }]}>
        <SkinBackdrop />
        {header}
        <Text testID="sentences-round-done" style={[styles.hint, { color: colors.text }]}>
          {s.sentenceTab.roundDone(done)}
        </Text>
        {g.brutal ? (
          <BrutalButton testID="sentences-more" label={s.sentenceTab.more} fill="a" onPress={() => { setLoading(true); void load(); }} style={styles.moreBtn} />
        ) : (
          <Pressable
            testID="sentences-more"
            accessibilityRole="button"
            style={[styles.moreBtn, styles.moreBtnClassic, { backgroundColor: colors.accent }]}
            onPress={() => {
              setLoading(true);
              void load();
            }}
          >
            <Text style={[styles.moreBtnText, { color: colors.onTint }]}>{s.sentenceTab.more}</Text>
          </Pressable>
        )}
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
        {phase === 'build' ? s.sentenceTab.stepBuild : s.sentenceTab.stepType}
      </Text>
      {phase === 'build' ? (
        <ScrollView
          style={styles.cardScroll}
          contentContainerStyle={{ paddingBottom: g.brutal ? 100 : 24 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <BuildStep key={`build-${current.itemId}-${seq}`} entry={current} target={target} onResult={onBuildResult} />
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
          onResult={(correct) => void onTypeResult(correct)}
          dockLift={dockLift}
          dockH={dockH}
          onDockHeight={setDockH}
          gradeButtons
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  centered: { justifyContent: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '700' },
  brutalTitle: { textTransform: 'uppercase', fontWeight: '500' },
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
