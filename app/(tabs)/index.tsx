import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { StyleSheet, Text, View, Pressable, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, ScrollView, Image, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { fsrs, Rating, type Card, type Grade } from 'ts-fsrs';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { getDb } from '@/lib/database';
import { type WordEntry, getWordsForLevel, getWordsForTopic, findWordByText, normalizeWordToken, LEVELS, type Level } from '@/data/words';
import TappableSentence, { type TokenState } from '@/components/TappableSentence';
import { getTopicsForLevel, hasTopics, getTopicName, getSubLevelForTopic, getTopicsForSubLevel, getSubLevelName, type TopicDef } from '@/data/topics';
import { t, stringsFor } from '@/lib/i18n';
import { strictAnswerMatch } from '@/lib/answerMatch';
import { nearMissDistractors } from '@/lib/distractors';
import { consumePendingAction } from '@/lib/pendingAction';
import { DAILY_NEW_BONUS_STEP } from '@/lib/usageStats';
import { capNewWords, newWordsLeftToday, newWordIntake, newWordPauseReason, type NewWordAllowance, type NewWordPause } from '@/lib/newWordBudget';
import { borrowNewWords, countNewWords, nextTopicWithNewWords } from '@/lib/topicRotation';
import { wordPhase, phaseShape, type WordPhase } from '@/lib/wordPhase';
import { isTopicMastered, masteredCount } from '@/lib/topicMastery';
import { buildQueue, applyCadence, dripNewWords, reviewBatchOf, reviewWordsLeft, type DueItem } from '@/lib/sessionQueue';
import { cardNote } from '@/lib/cardNotes';
import { charDiff } from '@/lib/charDiff';
import { ARTICLE_OPTIONS, articleOf, articlePickerApplies, composeAnswer, type ArticlePick } from '@/lib/articlePicker';
import { cardIcon } from '@/lib/cardIcons';
import { cardImage } from '@/lib/cardImages';
import FeedbackButton from '@/components/FeedbackModal';
import { speak as speakIn, loadVoices } from '@/lib/speech';
import MockExamMode from '@/components/exam/MockExamMode';
import DoneScreen from '@/components/DoneScreen';
import EasySentenceCard from '@/components/EasySentenceCard';
import LearnChrome from '@/components/LearnChrome';
import { languages, speechLang } from '@/lib/languages';
import { buildMockExam } from '@/lib/exam/buildMockExam';
import { answerInputProps } from '@/lib/inputProps';

const f = fsrs();

// FB170: height of the docked Check bar (button plus its padding), the room the
// typing card has to keep free at its bottom.
const DOCK_RESERVE = 76;

// ITER5: the header used to be absolutely positioned, so it needed a measured
// reserve (HEADER_RESERVE_MIN) and a font-scale cap here. LearnChrome sits in
// the flow above the scroll view, so neither is needed; the cap lives there.

type TypingResult = 'correct' | 'almost' | 'wrong' | 'skipped' | null;

// FB25/FB84: char diff lives in lib/charDiff.ts now, shared with the spelling
// trainer, which used to carry a hand-copied twin of it.

export default function LearnScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<DueItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [streak, setStreak] = useState(0);
  const [reviewed, setReviewed] = useState(0);
  const [done, setDone] = useState(false);
  // FB77: how many brand-new words today's budget still allows (0 = the Done
  // screen offers the "+5 new words" button).
  const [newWordsLeft, setNewWordsLeft] = useState(0);
  // FB114: the daily budget is unspent but the half-learned pile hit the WIP
  // ceiling, so no new word joins the queue right now. Shown as ⏸ on the badge,
  // otherwise the countdown would look stuck without saying why.
  const [newWordsPaused, setNewWordsPaused] = useState(false);
  // FB132: Settings -> Difficulty, "accents count". Off = the beginner grader
  // forgives a missing á/é/ñ; on = it fails the answer and the diff paints it.
  const [strictAccents, setStrictAccents] = useState(false);
  // FB188: a névelő-gombsor kapcsolója (Beállítások) és az aktuális kártyán
  // választott névelő. Kártyaváltáskor nullázódik, mint a begépelt válasz.
  const [articlePickerOn, setArticlePickerOn] = useState(true);
  const [articlePick, setArticlePick] = useState<ArticlePick>('');
  // FB170, Kálmán 2026-09-06: "azt akarom hogy a check rész az pont a klaviatúrám
  // felett legyen és nem kell ketto". The typing card had two Check buttons (the
  // in-card one from FB5 and the older one below the card); there is one now, docked
  // to the bottom edge of this screen.
  //
  // Three tries to place it, and the reason the first two missed was never the
  // keyboard height, it was what sat under the container:
  //   FB170 lifted the bar by the reported keyboard height, and the visible TAB BAR
  //     below the container ate that much of the lift (a ~49 dp gap).
  //   FB172 measured instead, and mixed window coordinates with the keyboard's screen
  //     coordinates, so the bar slid under the keys.
  //   FB175 asked the window to resize, which an edge-to-edge Android window does not
  //     do (the IME arrives as an inset), so the bar stayed at the screen bottom,
  //     completely behind the keyboard.
  // FB176: with `tabBarHideOnKeyboard` (FB175) the container now ends AT the bottom of
  // the screen while typing, which is exactly where the reported keyboard height is
  // measured from, so the plain arithmetic is the correct one after all.
  const [kbHeight, setKbHeight] = useState(0);
  // FB178: the keyboard event reports the height of the KEYS ONLY. On a phone with the
  // three-button navigation bar the keyboard sits ON TOP of that bar, so its top edge is
  // kbHeight + the bottom safe-area inset above the screen bottom. Lifting by the raw
  // height left the bar a navigation bar too low, which is why it stayed behind the keys.
  const insets = useSafeAreaInsets();
  // FB135/FB136: how many untouched words the ACTIVE topic still holds, and the
  // next topic that holds some. Zero here with a topic left to go is the state
  // where the session ends with nothing on offer, see lib/topicRotation.ts.
  const [newWordsInTopic, setNewWordsInTopic] = useState(0);
  const [nextTopicId, setNextTopicId] = useState<string | null>(null);
  // FB142, Kálmán 2026-08-18: "valahogy jelölje az app, hogy mennyi szó van és
  // mennyi ismétlődik ... már rég óta 0 új szót ír de mintha újra és újra régi
  // szavakat bedobna ismétlésre". The queue's own split (new vs review), the
  // half-learned pile behind a pause, and the reason for the pause, so the Done
  // screen can say what the session was made of and why.
  const [sessionMix, setSessionMix] = useState<{ newWords: number; reviews: number }>({ newWords: 0, reviews: 0 });
  // FB174, Kálmán 2026-09-06: "azt akarom látni, hogy mennyi van osszesen amit
  // ismételni kell ... legyen ott egy 30/3 hogy ha meg 3 szor van 30 szo". The queue
  // only ever holds one batch, so the header also names the batch size and how many
  // more batches of that size are waiting behind it.
  const [reviewBatch, setReviewBatch] = useState<{ size: number; left: number; dueToday: number }>(
    { size: 0, left: 0, dueToday: 0 },
  );
  // FB158/FB159, Kálmán 2026-08-26 (word:"the volleyball", majd word:"belly"):
  // "kellene valami különbség, hogy tudjam, hogy most a régi szavakat ismételem,
  // vagy az újakat tanulom", kétszer kérve. A 🌱 fejléc-jelvény csak a NAPI keretet
  // számolja, arról nem szól, hogy az ÉPP LÁTOTT kártya új-e. Egy szó, ami reps === 0
  // állapotban lépett a sorba, az egész munkamenetre "új" marad, különben a fázis-1 /
  // fázis-2 requeue (ott már reps > 0) félúton átbillentené a címkét.
  const [newTodayIds, setNewTodayIds] = useState<Set<number>>(() => new Set());
  // FB180, Kálmán 2026-09-07 (word:"the bedroom"): „5 szót írt de valójában 8 szó
  // volt benne". The 🔁 badge counted the review words of THIS queue with one rule
  // and sized the batch with another, so the two drifted apart. `newTodayIds` above
  // is session-wide on purpose (FB158: a word that arrived new stays new for the
  // 🌱 tag), which is the wrong set for a per-queue counter: a word that arrived new
  // this morning and is genuinely under review now would never be counted again.
  // This one holds the new words of the CURRENT queue only, and both sides use it.
  const [batchNewIds, setBatchNewIds] = useState<Set<number>>(() => new Set());
  const [unlearnedCount, setUnlearnedCount] = useState(0);
  const [pauseReason, setPauseReason] = useState<NewWordPause>('none');
  const [direction, setDirection] = useState<[string, string]>(['es', 'hu']);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [typingResult, setTypingResult] = useState<TypingResult>(null);
  // FB39: local per-card flag, flips the "Spelling" button to a ✓ state once
  // tapped; resets whenever the card changes (via resetCardState).
  const [spellingAdded, setSpellingAdded] = useState(false);
  // FB150: words of THIS card tapped into the spelling list, keyed by the
  // normalized token, so the same word stays marked wherever it appears.
  const [spellingTokens, setSpellingTokens] = useState<Record<string, TokenState>>({});
  const [spellingTapMsg, setSpellingTapMsg] = useState<string | null>(null);
  // FB75/FB78/FB79: whether the card's grammar note ("i" button) is expanded.
  const [noteOpen, setNoteOpen] = useState(false);
  const [level, setLevel] = useState<Level>('A0');
  const [levelUpMsg, setLevelUpMsg] = useState<string | null>(null);
  const [cardStartTime, setCardStartTime] = useState<number>(() => Date.now());
  const [practiceTyping, setPracticeTyping] = useState(false);
  const [practiceResult, setPracticeResult] = useState<TypingResult>(null);
  const [practiceText, setPracticeText] = useState('');
  const [examMode, setExamMode] = useState(false);
  const [examLevel, setExamLevel] = useState<Level | null>(null);
  const [masteredPct, setMasteredPct] = useState(0);
  const [knownWords, setKnownWords] = useState(0);
  const [levelTotal, setLevelTotal] = useState(0);
  const [currentTopic, setCurrentTopic] = useState<TopicDef | null>(null);
  const [topicProgress, setTopicProgress] = useState<{ done: number; total: number; wordsInTopic: number; wordsReviewed: number } | null>(null);
  const [topicCompleteMsg, setTopicCompleteMsg] = useState<string | null>(null);
  // FB139: words pulled in from a neighbouring topic to fill the new-word budget,
  // mapped to the topic they came from so the card can name it.
  const [borrowedTopics, setBorrowedTopics] = useState<Map<number, TopicDef>>(new Map());
  // FB21: transient toast shown after a tech-tree topic switch, signalling that
  // the change affects FUTURE cards, not past progress.
  const [topicSwitchMsg, setTopicSwitchMsg] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);
  // Guards advance() against double-fire on the same card while its persistence
  // (several awaited DB writes) is still running.
  const advancingRef = useRef(false);


  // `stateMap` = szavankénti FSRS állapot. A topic-készültség EBBŐL dől el
  // (lib/topicMastery.ts), nem a repsMap-ből: egyszer látni egy szót nem tudás,
  // és az új topic csak akkor indulhat, ha a régi szavai kiléptek a Learningből.
  // A repsMap marad az "elkezdett-e egyáltalán" jelzésre.
  const computeUnlockedTopics = (topics: TopicDef[], repsMap: Map<number, number>, stateMap: Map<number, number>, currentLevel: Level, selectedTopicId?: string | null, lang: string = 'es', randomPick: boolean = false): { unlocked: TopicDef[]; activeTopic: TopicDef | null; completedCount: number } => {
    // Any level with a topic taxonomy (A0/A1/A2): all topics freely selectable,
    // no sequential lock. Levels without topics keep the sequential unlock logic.
    let unlocked: TopicDef[];
    if (topics.length > 0) {
      unlocked = [...topics];
    } else {
      unlocked = [];
      for (const topic of topics) {
        if (unlocked.length === 0) {
          unlocked.push(topic);
        } else {
          const prevTopic = topics[topics.indexOf(topic) - 1];
          const prevWords = getWordsForTopic(currentLevel, prevTopic.id, lang);
          const allReviewed = prevWords.length > 0 && prevWords.every(w => (repsMap.get(w.id) ?? 0) > 0);
          if (allReviewed) {
            unlocked.push(topic);
          } else {
            break;
          }
        }
      }
    }

    const topicComplete = (topic: TopicDef) =>
      isTopicMastered(getWordsForTopic(currentLevel, topic.id, lang).map(w => w.id), stateMap);

    let completedCount = 0;
    for (const topic of unlocked) {
      if (topicComplete(topic)) completedCount++;
    }

    // Active topic: use persisted selectedTopic if set and not fully complete,
    // otherwise fall back to first incomplete topic by order.
    let activeTopic: TopicDef | null = null;
    if (selectedTopicId) {
      const sel = unlocked.find(t => t.id === selectedTopicId);
      if (sel && !topicComplete(sel)) activeTopic = sel;
    }
    if (!activeTopic) {
      const isIncomplete = (topic: TopicDef) => !topicComplete(topic);
      if (randomPick) {
        // FB37: instead of always the first incomplete topic by order, draw
        // uniformly among ALL incomplete topics so learning doesn't always
        // fall back to the same "start of the queue" topic.
        const incomplete = unlocked.filter(isIncomplete);
        activeTopic = incomplete.length > 0
          ? incomplete[Math.floor(Math.random() * incomplete.length)]
          : unlocked[unlocked.length - 1] ?? null;
      } else {
        activeTopic = unlocked.find(isIncomplete) ?? unlocked[unlocked.length - 1] ?? null;
      }
    }

    return { unlocked, activeTopic, completedCount };
  };

  // FB135/FB136: record what is still available AFTER this queue, so the Done
  // screen can say why the session ended and offer the way on. Runs on both
  // queue builds (initial load and end-of-queue refill), the same as the topic
  // progress next to it.
  const applyTopicSupply = (
    unlocked: TopicDef[],
    activeTopic: TopicDef | null,
    lvl: Level,
    lang: string,
    repsMap: Map<number, number>,
  ) => {
    const newWordsOf = (topicId: string) =>
      countNewWords(getWordsForTopic(lvl, topicId, lang).map(w => w.id), repsMap);
    setNewWordsInTopic(activeTopic ? newWordsOf(activeTopic.id) : 0);
    setNextTopicId(
      nextTopicWithNewWords(
        unlocked.map(t => ({ id: t.id, order: t.order, newWords: newWordsOf(t.id) })),
        activeTopic?.id ?? null,
      ),
    );
  };

  // FB142: what this queue actually holds, and why it holds no new words. Runs
  // on both queue builds, right after the final item list exists, so the Done
  // screen never has to recompute it.
  const applyQueueSupply = (items: DueItem[], budget: NewWordAllowance, dueReviewWords = 0) => {
    const isNew = (item: DueItem) => item.type === 'word' && item.card.reps === 0;
    setSessionMix({
      newWords: items.filter(isNew).length,
      reviews: items.filter(item => !isNew(item)).length,
    });
    // FB174/FB180: batch size and the counter that shrinks as it is answered now
    // share one definition, in lib/sessionQueue.
    const batch = reviewBatchOf(items, dueReviewWords);
    setBatchNewIds(batch.newIds);
    setReviewBatch({ size: batch.size, left: batch.left, dueToday: batch.dueToday });
    // FB158/FB159: remember which words arrived brand new, the per-card tag reads this.
    setNewTodayIds((prev) => {
      const next = new Set(prev);
      items.filter(isNew).forEach((item) => next.add(item.wordId));
      return next;
    });
    setUnlearnedCount(budget.unlearned ?? 0);
    setPauseReason(newWordPauseReason(budget));
  };

  // FB139, Kálmán 2026-08-17: "ha 15 új szót kell beadni ... és a témakörből,
  // nincsen 15 szó akkor szedjen össze a körülötte lévő topicokból". The queue is
  // scoped to the active topic, so a raised budget used to hand out only what that
  // topic still had. The shortfall now comes from the nearest topics, and the
  // borrowed words are remembered so the card can say which topic they belong to.
  const withBorrowedNewWords = (
    scoped: WordEntry[],
    unlocked: TopicDef[],
    activeTopic: TopicDef | null,
    lvl: Level,
    lang: string,
    repsMap: Map<number, number>,
    intake: number,
  ): WordEntry[] => {
    if (!activeTopic) {
      setBorrowedTopics(new Map());
      return scoped;
    }
    const activeNew = countNewWords(
      getWordsForTopic(lvl, activeTopic.id, lang).map(w => w.id),
      repsMap,
    );
    const others = unlocked.filter(tp => tp.id !== activeTopic.id);
    const supplies = others.map(tp => ({
      id: tp.id,
      order: tp.order,
      newWordIds: getWordsForTopic(lvl, tp.id, lang)
        .filter(w => (repsMap.get(w.id) ?? 0) === 0)
        .map(w => w.id),
    }));
    const picked = borrowNewWords(supplies, activeTopic.order, intake - activeNew);
    if (picked.length === 0) {
      setBorrowedTopics(new Map());
      return scoped;
    }
    const topicById = new Map(others.map(tp => [tp.id, tp]));
    const wordById = new Map(
      others.flatMap(tp => getWordsForTopic(lvl, tp.id, lang)).map(w => [w.id, w]),
    );
    const borrowed = new Map<number, TopicDef>();
    const extra: WordEntry[] = [];
    for (const p of picked) {
      const word = wordById.get(p.wordId);
      const topic = topicById.get(p.topicId);
      if (!word || !topic) continue;
      extra.push(word);
      borrowed.set(word.id, topic);
    }
    setBorrowedTopics(borrowed);
    return [...scoped, ...extra];
  };

  const QUEUE_POOL = 40;

  const loadCards = async () => {
    const db = getDb();
    const onboarding = await db.getOnboarding();
    if (onboarding) {
      setDirection([onboarding.source, onboarding.target]);
    }

    const levelData = await db.getLevel();
    const currentLevel = levelData.level as Level;
    setLevel(currentLevel);

    const learned = onboarding?.target ?? 'es';
    const levelWords = getWordsForLevel(currentLevel, learned);
    const topics = getTopicsForLevel(currentLevel, learned);
    const useTopics = topics.length > 0 && levelWords.some(w => w['topic']);

    // FB77: today's remaining new-word budget (setting + "+5 new words" taps).
    // FB112-115: the badge shows the DAILY countdown, the queue intake pauses
    // separately when the half-learned pile hits the WIP ceiling.
    // FB139: read before the queue is scoped, because the intake decides whether
    // the active topic needs a top-up from its neighbours.
    const budget = {
      limit: await db.getDailyNewLimit(),
      bonus: await db.getNewLimitBonus(),
      startedToday: await db.getNewWordsToday(),
      unlearned: await db.getUnlearnedWordCount(),
    };
    const leftToday = newWordsLeftToday(budget);
    const intake = newWordIntake(budget);
    setNewWordsLeft(leftToday);
    setNewWordsPaused(intake === 0 && leftToday > 0);

    let activeWords: WordEntry[];
    if (useTopics) {
      const allWordIds = levelWords.map(w => w.id);
      const repsMap = await db.getWordReps(allWordIds);
      const stateMap = await db.getWordStates(allWordIds);
      const savedTopic = await db.getSelectedTopic();
      const randomTopics = await db.getRandomTopics();
      const { unlocked, activeTopic, completedCount } = computeUnlockedTopics(topics, repsMap, stateMap, currentLevel, savedTopic, learned, randomTopics);
      // FB37: persist a freshly-drawn random topic so a mid-session reload or
      // queue rebuild doesn't jump again, the next draw only happens once
      // this topic completes.
      if (randomTopics && activeTopic && activeTopic.id !== savedTopic) {
        await db.setSelectedTopic(activeTopic.id);
      }

      setCurrentTopic(activeTopic);
      setTopicProgress({
        done: completedCount,
        total: topics.length,
        wordsInTopic: activeTopic ? getWordsForTopic(currentLevel, activeTopic.id, learned).length : 0,
        wordsReviewed: activeTopic ? masteredCount(getWordsForTopic(currentLevel, activeTopic.id, learned).map(w => w.id), stateMap) : 0,
      });

      activeWords = activeTopic
        ? [
            ...getWordsForTopic(currentLevel, activeTopic.id, learned),
            ...unlocked
              .filter(t => t.id !== activeTopic!.id)
              .flatMap(t => getWordsForTopic(currentLevel, t.id, learned))
              .filter(w => (repsMap.get(w.id) ?? 0) > 0),
          ]
        : unlocked.flatMap(t => getWordsForTopic(currentLevel, t.id, learned));

      // FB139: top the new-word supply up from the neighbouring topics.
      activeWords = withBorrowedNewWords(activeWords, unlocked, activeTopic, currentLevel, learned, repsMap, intake);

      // FB135/FB136: what the Done screen can still offer once this queue runs out.
      applyTopicSupply(unlocked, activeTopic, currentLevel, learned, repsMap);
    } else {
      setCurrentTopic(null);
      setTopicProgress(null);
      setBorrowedTopics(new Map());
      activeWords = levelWords;
    }

    for (const w of activeWords) {
      await db.ensureCard(w.id, 'word');
      await db.ensureCard(w.id, 'sentence');
    }

    const totalWords = levelWords.length;
    const reviewedWords = await db.getReviewedWordCount(currentLevel);
    const masteredWords = await db.getMasteredWordCount(currentLevel);
    const pct = totalWords > 0 ? Math.round((reviewedWords / totalWords) * 100) : 0;
    const mPct = totalWords > 0 ? Math.round((masteredWords / totalWords) * 100) : 0;
    setMasteredPct(mPct);
    setKnownWords(reviewedWords);
    setLevelTotal(totalWords);

    const wordsOnly = await db.getWordsOnly();
    // FB132: read once per queue build, the same moment the other learn settings
    // are read (the Settings toggle queues a reload, see handleStrictAccentsToggle).
    setStrictAccents(await db.getStrictAccents());
    setArticlePickerOn(await db.getArticlePicker());
    const activeWordIds = activeWords.map(w => w.id);
    const rows = useTopics
      ? await db.getDueCardsForWordIds(activeWordIds, QUEUE_POOL)
      : await db.getDueCardsForLevel(currentLevel, QUEUE_POOL);
    // FB174: the whole due pile in the same scope, not just what fits in this queue.
    const dueReviewWords = useTopics
      ? await db.countDueReviewWords(activeWordIds)
      : await db.countDueReviewWordsForLevel(currentLevel);
    const items = applyCadence(dripNewWords(capNewWords(buildQueue(rows, learned), intake)), wordsOnly, learned);
    applyQueueSupply(items, budget, dueReviewWords);

    const streakData = await db.getStreak();
    setStreak(streakData.current_count);
    setQueue(items);
    setCurrentIndex(0);
    setRevealed(false);
    setReviewed(0);
    setTypedAnswer('');
    setArticlePick('');
    setTypingResult(null);
    setDone(items.length === 0);

    setCardStartTime(Date.now());
    setPracticeTyping(false);
    setPracticeResult(null);
    setPracticeText('');
    setLoading(false);
  };

  // FB77: raise today's new-word budget and rebuild the queue right away, so the
  // learner can keep going instead of waiting for tomorrow. FB133: by 5, 10 or
  // 15, whichever button was tapped.
  const handleMoreNewWords = async (extra: number = DAILY_NEW_BONUS_STEP) => {
    const db = getDb();
    await db.addNewLimitBonus(extra);
    setLoading(true);
    await loadCards();
  };

  // FB135/FB136: the active topic has no untouched words left and its remaining
  // ones are not due yet, so raising the daily budget would change nothing. Move
  // to the next topic that still has new words and rebuild from there.
  const handleNextTopicWords = async () => {
    if (!nextTopicId) return;
    const db = getDb();
    await db.setSelectedTopic(nextTopicId);
    setLoading(true);
    await loadCards();
  };

  useEffect(() => {
    // FB144: learn which voices the phone owns before the first card speaks,
    // otherwise the opening word can still go out in the wrong voice.
    loadVoices();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCards();
  }, []);

  // On returning to the Learn tab, run any action the Settings tab queued:
  // a full restart, or the exam of a chosen (previous) level.
  useFocusEffect(
    useCallback(() => {
      const p = consumePendingAction();
      if (!p) return;
      if (p.type === 'restart') {
        (async () => {
          const db = getDb();
          await db.resetAllProgress();
          setExamMode(false);
          setExamLevel(null);
          await loadCards();
        })();
      } else if (p.type === 'exam') {
        setExamLevel(p.examLevel);
        setExamMode(true);
      } else if (p.type === 'setLevel') {
        // Master: direct level switch, no exam gate.
        (async () => {
          const db = getDb();
          await db.updateLevel(p.level, 0, 0, 0);
          setExamMode(false);
          setExamLevel(null);
          await loadCards();
        })();
      } else if (p.type === 'selectTopic') {
        // Tech-tree topic selection: reload cards from the newly selected topic,
        // then toast that the switch affects FUTURE cards only, not past progress (FB21).
        (async () => {
          await loadCards();
          const db = getDb();
          const tid = await db.getSelectedTopic();
          const ob = await db.getOnboarding();
          // Content comes from the language being learned, the NAME is read by
          // the learner, so it follows their own language (see topicLang).
          const tlang = ob?.target ?? 'es';
          const nameLang = ob?.source === 'hu' ? 'hu' : ob?.source === 'es' ? 'es' : ob?.source === 'de' ? 'de' : 'en';
          const lvl = (await db.getLevel()).level as Level;
          const tp = tid ? getTopicsForLevel(lvl, tlang).find((t) => t.id === tid) : null;
          if (tp) {
            setTopicSwitchMsg(s.topic.switchToast(getTopicName(tp, nameLang)));
            setTimeout(() => setTopicSwitchMsg(null), 3500);
          }
        })();
      }
    }, [])
  );

  const current = queue[currentIndex];

  // FB178: how far the docked bar has to sit above the bottom of this screen. With the
  // keyboard closed that is just the navigation bar; with it open, the keys plus the bar.
  const dockLift = kbHeight > 0 ? kbHeight + insets.bottom : insets.bottom;

  // FB176: 'Did' events, not 'Will': Android only fires those.
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // FB169, Kálmán 2026-09-05: the words still waiting for review in THIS queue, so it
  // shrinks with every card answered. "New" here is the FB158 rule (a word that entered
  // the queue with reps === 0 stays new for the session), and distinct wordIds are
  // counted, because one word can hold three cards.
  const batchLeft = useMemo(
    () => reviewWordsLeft(queue, currentIndex, batchNewIds),
    [queue, currentIndex, batchNewIds],
  );

  // FB177, Kálmán 2026-09-06: "a rozsaszin csik az az ööszes ismételendő szót mutassa
  // ne csak azt a 30 at amit most tanulok ... jelezze, hogy még mennyit kell ismételni
  // ma". The queue holds one batch, so the batch counter emptied and refilled. The
  // header shows the whole day's pile instead: everything that was due when this queue
  // was built, minus what has been answered out of the batch since.
  const reviewLeft = useMemo(() => {
    const doneInBatch = Math.max(0, reviewBatch.size - batchLeft);
    return Math.max(batchLeft, reviewBatch.dueToday - doneInBatch);
  }, [reviewBatch, batchLeft]);

  const getFrontBack = (item: DueItem) => {
    const [native, learned] = direction;
    const isWord = item.type === 'word';

    let frontLang = learned;
    let backLang = native;
    if (item.typingDirection === 'native-to-learned') {
      frontLang = native;
      backLang = learned;
    }

    return {
      front: String(isWord ? item.word[frontLang] : item.word[`sentence_${frontLang}`]),
      back: String(isWord ? item.word[backLang] : item.word[`sentence_${backLang}`]),
      frontLang,
      backLang,
    };
  };

  // FB116: the prompt is read out loud in whatever language it is shown in, not
  // only when that happens to be the learned one ("csináld meg úgy az appot hogy
  // ha bejön egy szó akkor kimondja angolul is. vagy ha spanyolul jön akkor is
  // kimondja, meg a mondatokat is").
  useEffect(() => {
    if (!current || loading || done) return;
    const [native] = direction;
    // Easy sentence (tap-to-order): the learned-language sentence IS the answer the
    // user must assemble, so only its native prompt is spoken, never the solution.
    if (current.isEasySentence) {
      const prompt = String(current.word[`sentence_${native}`] ?? '');
      if (prompt) speakIn(prompt, speechLang(native));
      return;
    }
    const { front, frontLang } = getFrontBack(current);
    if (front) speakIn(front, speechLang(frontLang));
    // wordId + phase in the deps: a requeued card (FB109 ladder, FB43 skip) lands
    // at the SAME index in a same-length queue, so index alone would stay silent.
  }, [currentIndex, queue.length, loading, done, current?.wordId, current?.isTyping]);

  const checkLevelChange = async (wasCorrect: boolean) => {
    const db = getDb();
    const levelData = await db.getLevel();
    let { correct_streak, mistakes_in_window, fail_streak } = levelData;
    const currentLevel = levelData.level as Level;
    const levelIdx = LEVELS.indexOf(currentLevel);

    if (wasCorrect) {
      correct_streak += 1;
      fail_streak = 0;
    } else {
      fail_streak += 1;
      mistakes_in_window += 1;
      correct_streak = 0;
    }
    await db.updateLevel(currentLevel, correct_streak, mistakes_in_window, fail_streak);
  };

  const resetCardState = () => {
    setRevealed(false);
    setTypedAnswer('');
    setArticlePick('');
    setTypingResult(null);
    setCardStartTime(Date.now());
    setPracticeTyping(false);
    setPracticeResult(null);
    setPracticeText('');
    setSpellingAdded(false);
    setSpellingTokens({});
    setSpellingTapMsg(null);
    setNoteOpen(false);
  };

  // Shared by advance() and advanceNoRating(): once the queue is exhausted,
  // pull a fresh due batch (topic-aware) and rebuild it. Reads only
  // level/direction/topic state, no dependency on the just-rated card, so
  // both the rating and no-rating advance paths can reuse it verbatim.
  const rebuildQueueAtEnd = async () => {
    const db = getDb();
    const levelData = await db.getLevel();
    const currentLevel = levelData.level as Level;
    const learned = direction[1];
    const { getWordsForLevel: gwfl } = require('@/data/words');
    const lvlWords = gwfl(currentLevel, learned);
    const rvw = await db.getReviewedWordCount(currentLevel);
    const mst = await db.getMasteredWordCount(currentLevel);
    const newMPct = lvlWords.length > 0 ? Math.round((mst / lvlWords.length) * 100) : 0;
    setMasteredPct(newMPct);
    setKnownWords(rvw);
    setLevelTotal(lvlWords.length);

    const topics = getTopicsForLevel(currentLevel, learned);
    const useTopics = topics.length > 0 && lvlWords.some((w: WordEntry) => w['topic']);

    // FB139: as in loadCards, the intake is needed before the queue is scoped.
    const budget2 = {
      limit: await db.getDailyNewLimit(),
      bonus: await db.getNewLimitBonus(),
      startedToday: await db.getNewWordsToday(),
      unlearned: await db.getUnlearnedWordCount(),
    };
    const leftToday2 = newWordsLeftToday(budget2);
    const intake2 = newWordIntake(budget2);
    setNewWordsLeft(leftToday2);
    setNewWordsPaused(intake2 === 0 && leftToday2 > 0);

    let newRows: any[];
    // FB174: the due pile behind this refill, filled in on both branches below.
    let dueReviewWords2 = 0;
    if (useTopics) {
      const allWordIds = lvlWords.map((w: WordEntry) => w.id);
      const repsMap = await db.getWordReps(allWordIds);
      const stateMap = await db.getWordStates(allWordIds);
      const savedTopic2 = await db.getSelectedTopic();
      const randomTopics2 = await db.getRandomTopics();
      const { unlocked, activeTopic, completedCount } = computeUnlockedTopics(topics, repsMap, stateMap, currentLevel, savedTopic2, learned, randomTopics2);
      // FB37: persist a freshly-drawn random topic so it stays stable across
      // the rest of this session (next draw only once it completes again).
      if (randomTopics2 && activeTopic && activeTopic.id !== savedTopic2) {
        await db.setSelectedTopic(activeTopic.id);
      }

      if (topicProgress && completedCount > topicProgress.done && activeTopic) {
        const lang = direction[1] === 'hu' ? 'hu' : direction[1] === 'es' ? 'es' : direction[1] === 'de' ? 'de' : 'en';
        // Free ordering: the just-finished topic is the one the user was
        // studying, not the last one by order.
        const prevCompleted = currentTopic ?? topics[completedCount - 1];
        if (prevCompleted) {
          // Sub-level celebration: check if ALL topics in the sub-level are now
          // complete (free ordering, cannot rely on "last topic" position).
          const sub = getSubLevelForTopic(currentLevel, prevCompleted.id, learned);
          const subTopics = sub ? getTopicsForSubLevel(currentLevel, sub.id, learned) : [];
          const closesSubLevel = sub && subTopics.length > 0 && subTopics.every(st =>
            isTopicMastered(getWordsForTopic(currentLevel, st.id, learned).map(w => w.id), stateMap),
          );
          // FB148, Kálmán 2026-08-18: "nézd meg, hogy a felugró üzenetek, mindig
          // azon a nyelven vannak e amin a játékos tanul". The milestone toasts
          // already greet in the learned language (FB63); this celebration was
          // the odd one out, it came in the phone's interface language. The
          // sub-level NAME keeps whatever language it had here.
          const celebrate = stringsFor(learned);
          setTopicCompleteMsg(
            closesSubLevel
              ? `${celebrate.topic.complete}\n${celebrate.subLevel.complete(sub.id, getSubLevelName(sub, lang))}`
              : celebrate.topic.complete,
          );
          setTimeout(() => setTopicCompleteMsg(null), 3000);
        }
      }

      setCurrentTopic(activeTopic);
      setTopicProgress({
        done: completedCount,
        total: topics.length,
        wordsInTopic: activeTopic ? getWordsForTopic(currentLevel, activeTopic.id, learned).length : 0,
        wordsReviewed: activeTopic ? masteredCount(getWordsForTopic(currentLevel, activeTopic.id, learned).map(w => w.id), stateMap) : 0,
      });

      // FB117: the refill has to be scoped EXACTLY like loadCards, i.e. the active
      // topic's words plus only the ALREADY STARTED words of the other unlocked
      // topics (their reviews). It used to pull every unlocked topic's words, so
      // the topic split held only until the first queue ran out, and from then on
      // brand-new words from other topics appeared under the current topic header
      // ("nem látom ezt a topicok alapján szét választott dolgot").
      const scopedWords = withBorrowedNewWords(
        activeTopic
          ? [
              ...getWordsForTopic(currentLevel, activeTopic.id, learned),
              ...unlocked
                .filter(t => t.id !== activeTopic!.id)
                .flatMap(t => getWordsForTopic(currentLevel, t.id, learned))
                .filter((w: WordEntry) => (repsMap.get(w.id) ?? 0) > 0),
            ]
          : unlocked.flatMap(t => getWordsForTopic(currentLevel, t.id, learned)),
        unlocked,
        activeTopic,
        currentLevel,
        learned,
        repsMap,
        intake2,
      );
      // FB135/FB136: same bookkeeping as in loadCards, for the Done screen.
      applyTopicSupply(unlocked, activeTopic, currentLevel, learned, repsMap);
      const activeWordIds = scopedWords.map((w: WordEntry) => w.id);
      for (const w of scopedWords) {
        await db.ensureCard(w.id, 'word');
        await db.ensureCard(w.id, 'sentence');
      }
      newRows = await db.getDueCardsForWordIds(activeWordIds, QUEUE_POOL);
      dueReviewWords2 = await db.countDueReviewWords(activeWordIds);
    } else {
      setBorrowedTopics(new Map());
      newRows = await db.getDueCardsForLevel(currentLevel, QUEUE_POOL);
      dueReviewWords2 = await db.countDueReviewWordsForLevel(currentLevel);
    }

    const wordsOnly2 = await db.getWordsOnly();
    const newItems = applyCadence(dripNewWords(capNewWords(buildQueue(newRows, learned), intake2)), wordsOnly2, learned);
    applyQueueSupply(newItems, budget2, dueReviewWords2);

    if (newItems.length === 0) {
      setDone(true);
    } else {
      setQueue(newItems);
      setCurrentIndex(0);
    }
    resetCardState();
  };

  // FB112/FB113: the 🌱 badge has to fall by ONE the moment a brand-new word is
  // answered ("nem így egyesével fogyott. hanem csak úgy ugrott egyet"). The DB
  // counter behind it (getNewWordsToday) is only re-read on a queue rebuild, so
  // the badge is stepped optimistically here, exactly like the streak.
  const spendNewWordBadge = (item: DueItem) => {
    if (item.type !== 'word' || (item.card.reps ?? 0) > 0) return;
    setNewWordsLeft((n) => Math.max(0, n - 1));
  };

  const advance = async (rating: Grade) => {
    if (!current || advancingRef.current) return;
    advancingRef.current = true;

    // Capture the rated card before any optimistic UI change.
    const item = current;
    const startTime = cardStartTime;
    spendNewWordBadge(item);
    const next = currentIndex + 1;
    const midQueue = next < queue.length;

    // FB11: word-card Good/Again felt dead/slow because ~8 awaited DB writes ran
    // before the next card appeared. For a mid-queue rating, show the next card
    // immediately and release the guard so it stays tappable; the SRS persistence
    // below runs in the background. (End-of-queue must await its batch rebuild.)
    if (midQueue) {
      setCurrentIndex(next);
      resetCardState();
      advancingRef.current = false;
    }

    try {
    const result = f.repeat(item.card, new Date());
    const updated = result[rating].card;
    const wasCorrect = rating !== Rating.Again;

    const responseTimeMs = Date.now() - startTime;

    const db = getDb();
    await db.updateCard(item.wordId, item.type, updated);
    await db.recordAttempt(item.wordId, item.type, wasCorrect, responseTimeMs);
    await db.updateStreak();
    setKnownWords(await db.getReviewedWordCount(level));
    await checkLevelChange(wasCorrect);

    const streakData = await db.getStreak();
    setStreak(streakData.current_count);

    setReviewed((r) => r + 1);

    if (!midQueue) {
      await rebuildQueueAtEnd();
    }
    } finally {
      if (!midQueue) advancingRef.current = false;
    }
  };

  // FB38: advance to the next card with NO SRS write at all (used by the
  // snooze button). Mirrors advance()'s optimistic mid-queue step and
  // queue-end rebuild, minus every rating/persistence call.
  const advanceNoRating = async () => {
    if (!current || advancingRef.current) return;
    advancingRef.current = true;
    const next = currentIndex + 1;
    const midQueue = next < queue.length;
    if (midQueue) {
      setCurrentIndex(next);
      resetCardState();
      advancingRef.current = false;
    } else {
      try {
        await rebuildQueueAtEnd();
      } finally {
        advancingRef.current = false;
      }
    }
  };

  // FB43/FB46: move the current card to the END of the queue (no rating), then
  // show whatever now sits at this same index, since removing the current
  // card shifts everything after it left by one, that's already the "next"
  // card, so the index itself doesn't move. A single-item queue is a no-op,
  // there's nowhere to send it, so just reset the card's local UI state.
  const requeueCurrent = () => {
    if (!current || advancingRef.current) return;
    if (queue.length <= 1) {
      resetCardState();
      return;
    }
    const item = current;
    const rest = queue.filter((_, i) => i !== currentIndex);
    setQueue([...rest, item]);
    resetCardState();
  };

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      if (done || loading) return;
      if (!current) return;
      if (current.isTyping) return;
      if (current.isEasySentence) return;
      if (!revealed) {
        setRevealed(true);
      } else {
        advance(Rating.Good);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const handleInSentence = async () => {
    if (!current) return;

    const result = f.repeat(current.card, new Date());
    const updated = result[Rating.Again].card;

    const responseTimeMs = Date.now() - cardStartTime;

    const db = getDb();
    await db.updateCard(current.wordId, current.type, updated);
    await db.recordAttempt(current.wordId, current.type, false, responseTimeMs);
    await db.updateStreak();
    setKnownWords(await db.getReviewedWordCount(level));
    await checkLevelChange(false);

    const streakData = await db.getStreak();
    setStreak(streakData.current_count);
    setReviewed(reviewed + 1);

    const sentenceCard: DueItem = {
      wordId: current.wordId,
      type: 'sentence',
      card: current.card,
      word: current.word,
      isTyping: false,
    };

    const newQueue = queue.filter((item, i) =>
      i === currentIndex || !(item.wordId === current.wordId && item.type === 'sentence')
    );
    const insertAt = newQueue.indexOf(current) + 1;
    newQueue.splice(insertAt, 0, sentenceCard);
    setQueue(newQueue);
    setCurrentIndex(insertAt);
    setRevealed(false);
    setTypedAnswer('');
    setArticlePick('');
    setTypingResult(null);
    setCardStartTime(Date.now());
    setPracticeTyping(false);
    setPracticeResult(null);
    setPracticeText('');
  };

  // FB116: a skipped card is still read out loud, the word AND its sentence ("ha
  // nem irok be semmit de nyomok a következőre akkor is mondja ki a szót és a
  // mondatot"). This is the one part of FB43 that the learner reversed.
  const speakSkippedAnswer = (item: DueItem) => {
    const learned = direction[1];
    const { back, backLang } = getFrontBack(item);
    if (back) speakIn(back, speechLang(backLang));
    if (item.type !== 'word') return;
    const sentence = String(item.word[`sentence_${learned}`] ?? '');
    if (sentence) speakIn(sentence, speechLang(learned));
  };

  const handleCheck = () => {
    if (!current) return;
    // FB43: an empty answer isn't a wrong answer, it just means "not now" (too
    // hard / forgotten). Don't grade it, don't touch the fail streak. FB73: still
    // SHOW what the word would have been, then the → button sends the card to the
    // back of the queue (handleTypingNext). FB116: and read it out loud.
    // FB188: a válasz a gombsoron választott névelő ÉS a begépelt szó együtt.
    // Névelő nélkül (⊘) ez pontosan a régi viselkedés.
    const answer = composeAnswer(articlePick, typedAnswer);
    if (answer.length === 0) {
      setTypingResult('skipped');
      setRevealed(true);
      speakSkippedAnswer(current);
      return;
    }
    const { back, backLang } = getFrontBack(current);
    const correct = back.split(' / ')[0];

    // Strict (FB6): "she speak" must not pass for "She speaks", only case,
    // punctuation and missing accents are forgiven. FB132: the accent half of
    // that is switchable in Settings -> Difficulty.
    const ok = strictAnswerMatch(answer, correct, { strictAccents, lang: backLang });
    // Felfedéskor a gombsor a HELYES névelőt mutassa, hogy lássa, mit kellett volna.
    if (!ok) setArticlePick(articleOf(correct));
    setTypingResult(ok ? 'correct' : 'wrong');
    setRevealed(true);
    // FB90: the explanation is what a wrong answer needs, so open the "i" note by
    // itself after a miss (only then, a correct answer keeps the card quiet).
    if (!ok) setNoteOpen(true);
    // FB64: the recognition fallback is gone, so the answer is always read out
    // loud on reveal (nothing can cover the card any more).
    speakIn(back, speechLang(backLang));
  };

  // FB60: grade a card Again without leaving the current session queue. Mirrors
  // advance()'s SRS writes but runs them optimistically in the background (FB11/
  // FB19 pattern) and does NOT step the index, the caller decides where the card
  // goes (requeueCurrent puts it at the back). One Again write only, no double
  // penalty for the retry the learner is about to get.
  const gradeBackground = (item: DueItem, updated: Card, wasCorrect: boolean, startTime: number) => {
    const db = getDb();
    (async () => {
      try {
        await db.updateCard(item.wordId, item.type, updated);
        await db.recordAttempt(item.wordId, item.type, wasCorrect, Date.now() - startTime);
        await db.updateStreak();
        setKnownWords(await db.getReviewedWordCount(level));
        await checkLevelChange(wasCorrect);
        const streakData = await db.getStreak();
        setStreak(streakData.current_count);
      } catch {}
    })();
    setReviewed((r) => r + 1);
  };

  const gradeAgainBackground = (item: DueItem, startTime: number) => {
    spendNewWordBadge(item);
    gradeBackground(item, f.repeat(item.card, new Date())[Rating.Again].card, false, startTime);
  };

  // Replaces the current card with its next-phase twin a few cards later
  // (same index bookkeeping as requeueCurrent, see its comment).
  // FB163: the twin used to go to the very BACK, so with several new words in
  // flight the learner walked five ladders at once. A short gap of review cards
  // keeps exactly one new word in progress ("azt nyomja végig a 3 típusát, és
  // közben menjen a régi szavak ismétlése ... de egyesével") while still putting
  // real distance between the same word's two sightings.
  const PHASE_GAP = 3;
  const requeueAtPhase = (item: DueItem, card: Card, phase: WordPhase) => {
    const shape = phaseShape(phase);
    const nextItem: DueItem = { ...item, card, isTyping: shape.isTyping, typingDirection: shape.typingDirection };
    const rest = queue.filter((_, i) => i !== currentIndex);
    const insertAt = Math.min(rest.length, currentIndex + PHASE_GAP);
    const next = [...rest];
    next.splice(insertAt, 0, nextItem);
    setQueue(next);
    if (rest.length === 0) setCurrentIndex(0);
    resetCardState();
  };

  // FB109/FB111/FB114: walk the word's phase ladder INSIDE the session. A Good on
  // a word flashcard used to move the word's due date days out, so the reverse
  // flashcard and above all the TYPING card only surfaced on some later day ("nem
  // volt a begepelos rész miért", "most a gépelésből csak mondat van"). The word
  // now comes back at its next phase at the end of this queue, and leaves the
  // session only once it has been spelled right (FB111: "egy szó akkor számít
  // megtanultnak ha el tudjuk írni helyesen").
  const handleWordGood = () => {
    if (!current || current.type !== 'word' || current.isTyping || advancingRef.current) {
      advance(Rating.Good);
      return;
    }
    const item = current;
    const updated = f.repeat(item.card, new Date())[Rating.Good].card;
    const nextPhase = wordPhase(updated);
    if (nextPhase === wordPhase(item.card)) {
      advance(Rating.Good);
      return;
    }
    spendNewWordBadge(item);
    gradeBackground(item, updated, true, cardStartTime);
    requeueAtPhase(item, updated, nextPhase);
  };

  // FB105: Again on a word FLASHCARD means "I still don't know it", so the word
  // stays in this session's deck instead of only moving its due date (FB60 does
  // the same for a missed typed word). One Again write, then back of the queue.
  const handleWordAgain = () => {
    if (current && current.type === 'word') {
      gradeAgainBackground(current, cardStartTime);
      requeueCurrent();
      return;
    }
    advance(Rating.Again);
  };

  const handleTypingNext = () => {
    // FB73: the skipped (empty) answer stays ungraded, it only goes to the back.
    if (typingResult === 'skipped') {
      requeueCurrent();
      return;
    }
    if (typingResult === 'wrong') {
      // FB60: a missed typed WORD goes back into this session's deck (not just its
      // SRS due date) so the learner retries it now. The correct form is already
      // shown above (the `back` line + FB25 char-diff). Sentence typing keeps the
      // plain advance.
      if (current && current.type === 'word') {
        gradeAgainBackground(current, cardStartTime);
        requeueCurrent();
        return;
      }
      advance(Rating.Again);
    } else {
      advance(Rating.Good);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  if (examMode) {
    return (
      <MockExamMode
        level={examLevel ?? level}
        direction={direction as [string, string]}
        onLevelUp={(newLevel) => { setLevel(newLevel); setExamLevel(null); }}
        onExit={() => { setExamMode(false); setExamLevel(null); loadCards(); }}
      />
    );
  }

  if (done) {
    const examAvailable = buildMockExam(direction[1], direction[0], level).sections.length > 0 && masteredPct >= 80;
    return (
      <DoneScreen
        reviewed={reviewed}
        streak={streak}
        level={level}
        masteredPct={masteredPct}
        direction={direction as [string, string]}
        examAvailable={examAvailable}
        onStartExam={() => setExamMode(true)}
        currentTopic={currentTopic}
        topicProgress={topicProgress}
        newWordsLeft={newWordsLeft}
        newWordsPaused={newWordsPaused}
        onMoreNewWords={handleMoreNewWords}
        newWordsInTopic={newWordsInTopic}
        onNextTopicWords={nextTopicId ? handleNextTopicWords : undefined}
        sessionMix={sessionMix}
        unlearnedCount={unlearnedCount}
        pauseReason={pauseReason}
      />
    );
  }

  const { front, back, frontLang, backLang } = getFrontBack(current);
  const isWord = current.type === 'word';

  const speakTarget = () => {
    speakIn(back, speechLang(backLang));
  };

  // FB150: a tap on a word of the card files it into the spelling-practice list.
  // The list stores word ids, so a token with no card of its own (a conjugated
  // form, a function word) is reported instead of silently doing nothing.
  const handleWordTap = (token: string, lang: string) => {
    const key = normalizeWordToken(token);
    if (!key) return;
    const entry = findWordByText(token, lang, direction[1]);
    if (!entry) {
      setSpellingTokens(prev => ({ ...prev, [key]: 'missing' }));
      setSpellingTapMsg(s.card.spellingNoCardWord(token));
      return;
    }
    getDb().addToSpellingList(entry.id).catch(() => {});
    setSpellingTokens(prev => ({ ...prev, [key]: 'added' }));
    setSpellingTapMsg(s.card.spellingAddedWord(token));
  };

  const spellingTapLine = (
    <Text style={[styles.spellingTapLine, { color: spellingTapMsg ? colors.tint : colors.tabIconDefault }]}>
      {spellingTapMsg ?? s.card.spellingTapHint}
    </Text>
  );

  // Topic and sub-level names are interface text, so they follow the learner's
  // OWN language, like the rest of the UI. They used to follow the language being
  // learned, which showed a Spanish beginner "Köszönések" instead of "Saludos".
  const topicLang = direction[0] === 'hu' ? 'hu' : direction[0] === 'es' ? 'es' : direction[0] === 'de' ? 'de' : 'en';

  // FB75/FB78/FB79: optional "i" note explaining a grammar quirk of this card
  // (why "trousers" is plural but "el pantalón" isn't, what "unos" is doing
  // there). Written in the learner's own language.
  const note = cardNote(
    current.word as any,
    direction[0],
    direction[1],
    String(current.word[`sentence_${direction[1]}`] ?? '')
  );
  const noteText = !note
    ? null
    : note.kind === 'manual'
      ? note.text
      : note.kind === 'pairNoun'
        ? s.note.pairNoun
        : note.kind === 'serEstar'
          ? s.note.serEstar
          : s.note.someIndef;
  // FB86: picture cue on cards the learner keeps mixing up (flour vs flower),
  // shown on both sides since it belongs to the meaning, not to one language.
  const icon = cardIcon(current.word as any, direction[1]);
  const iconBadge = icon ? <Text style={styles.cardIcon}>{icon}</Text> : null;
  // FB124/FB127: a photo for words a gloss cannot picture ("the tapa").
  const photo = cardImage(current.word as any, direction[1]);
  const photoBlock = photo ? (
    <Image source={photo} style={styles.cardPhoto} resizeMode="cover" accessible={false} />
  ) : null;
  const noteButton = noteText ? (
    <Pressable onPress={() => setNoteOpen(o => !o)} style={styles.speakBtn}>
      <Text style={styles.speakIcon}>ℹ️</Text>
    </Pressable>
  ) : null;
  const noteBlock = noteText && noteOpen ? (
    <Text style={[styles.noteText, { color: colors.tabIconDefault }]}>{noteText}</Text>
  ) : null;

  // FB131: one place decides what a practice answer is worth, used by both the
  // keyboard's Enter and the inline ✓ button.
  const checkPractice = () => {
    // BUG-004: an empty field is not a wrong answer, the same rule the typing
    // card follows since FB43/FB73. Nothing to judge, so stay quiet.
    if (practiceText.trim().length === 0) return;
    setPracticeResult(
      strictAnswerMatch(practiceText, back.split(' / ')[0], { strictAccents, lang: backLang }) ? 'correct' : 'wrong'
    );
  };

  // FB138, Kálmán 2026-08-17 (word:"the flashlight"): "ha le akarok írni egy szót
  // akkor tűnjön el a megfejtés ahogy le akarom írni, és lehessen beírni, majd ha
  // jó vagy ha rossz legyen ugyan az csak irjak ki hogy jó vagy rossz, és lehessen
  // újra beírni a szót". The solution sat above the practice field, so the exercise
  // was copying, and a miss closed the field for good. It now hides while the field
  // is open and comes back once the answer is right.
  const practiceHidesAnswer = practiceTyping && practiceResult !== 'correct';

  // FB158/FB159: the tag says whether this card is new or a review, in the
  // interface language. ITER5 moved it onto the card as a chip, next to the
  // borrowed-topic chip, instead of owning a row of its own above the card.
  const isNewCard = newTodayIds.has(current.wordId);

  // FB139: a card borrowed from a neighbouring topic names its own topic, so the
  // status row above it is not read as the word's home ("csak akkor amikor a másik
  // témakör szava van akkor jelezze, hogy melyik szó az").
  const borrowedTopic = borrowedTopics.get(current.wordId) ?? null;

  const cardChips = (
    <View style={styles.cardChips}>
      <View style={[styles.chip, { backgroundColor: isNewCard ? '#22C55E' : '#38BDF8' }]}>
        <Text style={styles.chipText} numberOfLines={1} maxFontSizeMultiplier={1.3}>
          {isNewCard ? s.card.newWordTag : s.card.reviewTag}
        </Text>
      </View>
      {borrowedTopic && (
        <View style={[styles.chip, styles.chipOutline, { borderColor: colors.accent }]}>
          <Text style={[styles.chipText, { color: colors.accent }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {s.card.fromTopic(`${borrowedTopic.icon ?? ''} ${getTopicName(borrowedTopic, topicLang)}`.trim())}
          </Text>
        </View>
      )}
    </View>
  );
  const targetLangInfo = languages.find(l => l.code === direction[1]);

  // ITER5: one toast slot instead of two overlays that could stack on each
  // other. Level change wins over a finished topic, which wins over a switch.
  const chromeToast = levelUpMsg
    ? { text: levelUpMsg, tone: levelUpMsg.startsWith('↑') ? ('info' as const) : ('danger' as const) }
    : topicCompleteMsg
      ? {
          text: topicCompleteMsg,
          tone: 'success' as const,
          sub: hasTopics(level, direction[1]) ? `${s.topic.chooseTopic} →` : undefined,
          onPress: () => router.push('/(tabs)/tree'),
        }
      : topicSwitchMsg
        ? { text: topicSwitchMsg, tone: 'info' as const, onPress: () => router.push('/(tabs)/tree') }
        : null;

  // ITER5: the whole header is one component now, shared by all three render
  // branches below, so the branches cannot drift apart the way they did.
  const chrome = (
    <LearnChrome
      level={level}
      topicIcon={currentTopic ? (currentTopic.icon ?? (currentTopic.type === 'grammar' ? '📗' : '📘')) : null}
      topicName={currentTopic && topicProgress ? getTopicName(currentTopic, topicLang) : null}
      onTopicPress={() => router.push('/(tabs)/tree')}
      known={knownWords}
      total={levelTotal}
      langFlag={targetLangInfo?.flag ?? ''}
      langName={targetLangInfo?.name ?? ''}
      newWordsLeft={newWordsLeft}
      newWordsPaused={newWordsPaused}
      reviewLeft={reviewLeft}
      batchLeft={batchLeft}
      reviewBatchesLeft={reviewBatch.left}
      examUnlocked={masteredPct >= 80}
      onExamPress={() => setExamMode(true)}
      examLabel={s.exam.unlocked}
      toast={chromeToast}
    />
  );

  if (current.isEasySentence && !isWord) {
    const [native, learned] = direction;
    const nativeSentence = String(current.word[`sentence_${native}`]);
    const learnedSentence = String(current.word[`sentence_${learned}`]);
    // FB16: lowercase the sentence-initial word in the tile bank, a leading
    // capital reveals which tile starts the sentence. Grading stays case-insensitive.
    const rawTargetWords = learnedSentence.replace(/[.!?¡¿,;:]/g, '').split(/\s+/).filter(Boolean);
    const targetWordList = rawTargetWords.map((w, i) =>
      i === 0 ? w.charAt(0).toLowerCase() + w.slice(1) : w,
    );
    const levelWords = getWordsForLevel(level, learned);
    // Near-miss distractors (FB1): sibling articles + same-stem/ending forms
    // instead of random vocab, so the learner practises forms not random noise.
    const vocab = levelWords.map(w => String(w[learned]).split(' / ')[0]);
    const traps = nearMissDistractors(targetWordList, vocab, learned);

    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {chrome}
        {/* FB87: a long sentence with many chips grows past the centered column,
            so the card scrolls (shared scroll styles). */}
        <ScrollView
          style={styles.typingScroll}
          contentContainerStyle={styles.typingScrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
        <EasySentenceCard
          chips={cardChips}
          key={`${current.wordId}-${currentIndex}`}
          sourceSentence={nativeSentence}
          lang={learned}
          targetWords={targetWordList}
          trapWords={traps}
          onResult={(correct) => {
            advance(correct ? Rating.Good : Rating.Again);
          }}
          onBury={() => {
            const db = getDb();
            db.buryCard(current.wordId, current.type).catch(() => {});
            advance(Rating.Good);
          }}
          onSkip={requeueCurrent}
          mistakeNote={noteText}
          speechLocale={speechLang(learned)}
          strictAccents={strictAccents}
        />
        </ScrollView>
        <FeedbackButton level={level} languagePair={direction.join('→')} currentCard={`easy:${nativeSentence}`} />
      </View>
    );
  }

  if (current.isTyping) {
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
        <Pressable style={[styles.card, styles.typingCard, { backgroundColor: colors.card }]} onPress={() => Keyboard.dismiss()}>
          {cardChips}
          <View style={[styles.frontRow, { marginBottom: 16 }]}>
            {iconBadge}
            {/* FB150: the prompt is tappable word by word, straight into spelling practice. */}
            <TappableSentence
              text={front}
              style={[styles.frontText, { color: colors.text }]}
              tokenStates={spellingTokens}
              onWordPress={token => handleWordTap(token, frontLang)}
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
          {/* FB188: névelő-gombsor. Minden spanyol főnév-kártyán ott van, akkor is,
              ha a helyes alak névelőtlen, különben a puszta megjelenése elárulná,
              hogy kell névelő. ⊘ az alapállás, tehát aki nem nyúl hozzá, gépel. */}
          {articlePickerOn && articlePickerApplies(backLang, current.type === 'word' ? String(current.word.pos ?? '') : '') && (
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
                  onWordPress={token => handleWordTap(token, backLang)}
                />
                <Pressable onPress={speakTarget} style={styles.speakBtn}>
                  <Text style={styles.speakIcon}>🔊</Text>
                </Pressable>
              </View>
              {spellingTapLine}
            </View>
          )}
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.buryBtn, pressed && { backgroundColor: '#22C55E', borderRadius: 8 }]}
          onPress={() => {
            const db = getDb();
            db.buryCard(current.wordId, current.type).catch(() => {});
            advance(Rating.Good);
          }}
        >
          {({ pressed }) => <Text style={[styles.buryText, pressed && { color: '#FFFFFF' }]}>{s.buttons.iKnowThis}</Text>}
        </Pressable>

        {/* FB38: snooze the word 3 days without any SRS write. */}
        <Pressable
          style={({ pressed }) => [styles.buryBtn, pressed && { backgroundColor: '#22C55E', borderRadius: 8 }]}
          onPress={() => {
            const db = getDb();
            db.snoozeCard(current.wordId, current.type, 3).catch(() => {});
            advanceNoRating();
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
        <View style={[styles.dockedAction, { bottom: dockLift, backgroundColor: colors.background }]}>
          <Pressable
            style={[styles.inlineCheckBtn, { backgroundColor: revealed && typingResult === 'wrong' ? '#1D4ED8' : '#38BDF8' }]}
            onPress={revealed ? handleTypingNext : handleCheck}
          >
            <Text style={styles.inlineCheckText}>{revealed ? '→' : `✓ ${s.card.check}`}</Text>
          </Pressable>
        </View>

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
              onWordPress={token => handleWordTap(token, frontLang)}
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
                    onWordPress={token => handleWordTap(token, backLang)}
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
          onPress={() => {
            const db = getDb();
            db.buryCard(current.wordId, current.type).catch(() => {});
            advance(Rating.Good);
          }}
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
            advanceNoRating();
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
  counter: {
    fontSize: 14,
  },
  // ITER5: the mode tag and the borrowed-topic line used to be two rows above
  // the card. They are chips at the top of the card now, in the flow.
  cardChips: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  chipOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
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
  cardIcon: {
    fontSize: 30,
  },
  // FB124/FB127: bundled photo for words a gloss cannot picture.
  cardPhoto: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    marginBottom: 12,
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
  resultSection: {
    alignItems: 'center',
    marginTop: 12,
  },
  // FB75/FB78/FB79: expanded grammar note under the card front.
  noteText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  // FB172, Kálmán 2026-09-06: "fent a review tul messze van a tetejétől". The shared
  // card centres its content inside a 260 px minimum, so a short typing card (chip,
  // word, field) floated with a band of empty card above the Review chip. The typing
  // card hugs its content from the top instead; the flashcard branch keeps the block.
  typingCard: {
    minHeight: 0,
    justifyContent: 'flex-start',
    paddingTop: 18,
    paddingBottom: 20,
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
  dockedAction: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 10,
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
  // FB150: the one line that says what a tap on a word just did.
  spellingTapLine: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
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
  topicCount: {
    fontSize: 12,
    fontWeight: '500',
  },
});
