import { useEffect, useState, useRef, useCallback } from 'react';
import { StyleSheet, Text, View, Pressable, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { fsrs, Rating, type Card, type Grade } from 'ts-fsrs';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { getDb } from '@/lib/database';
import { type WordEntry, getWordsForLevel, getWordsForTopic, LEVELS, type Level } from '@/data/words';
import { getTopicsForLevel, hasTopics, getTopicName, getSubLevelForTopic, getTopicsForSubLevel, getSubLevelName, type TopicDef } from '@/data/topics';
import { t } from '@/lib/i18n';
import { strictAnswerMatch } from '@/lib/answerMatch';
import { nearMissDistractors } from '@/lib/distractors';
import { consumePendingAction } from '@/lib/pendingAction';
import { DAILY_NEW_BONUS_STEP } from '@/lib/usageStats';
import { capNewWords, newWordsLeftToday, newWordIntake } from '@/lib/newWordBudget';
import { wordPhase, phaseShape, type WordPhase } from '@/lib/wordPhase';
import { isTopicMastered, masteredCount } from '@/lib/topicMastery';
import { buildQueue, applyCadence, type DueItem } from '@/lib/sessionQueue';
import { cardNote } from '@/lib/cardNotes';
import { charDiff } from '@/lib/charDiff';
import { cardIcon } from '@/lib/cardIcons';
import { cardImage } from '@/lib/cardImages';
import FeedbackButton from '@/components/FeedbackModal';
import * as Speech from 'expo-speech';
import ExamMode from '@/components/ExamMode';
import DoneScreen from '@/components/DoneScreen';
import EasySentenceCard from '@/components/EasySentenceCard';
import ProgressMeter from '@/components/ProgressMeter';
import { languages, speechLang } from '@/lib/languages';
import { getExamQuestionsFor } from '@/data/exams';

const f = fsrs();

// FB122: the badge row is absolutely positioned over the card, so a very large
// system font size made it grow into the progress meter below it.
const HEADER_FONT_SCALE_CAP = 1.3;

// The header (level badge, topic row, sub-level line) is absolutely positioned,
// so the scrolling card has to reserve room for it. A constant 56 was fine at
// the default font size and too small at font_scale 1.5, where the progress
// meter rode over the sub-level line (caught on the emulator). The header
// measures itself instead, so any font size or translation length fits.
const HEADER_RESERVE_MIN = 56;

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
  const [headerBottom, setHeaderBottom] = useState(HEADER_RESERVE_MIN);
  const [direction, setDirection] = useState<[string, string]>(['es', 'hu']);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [typingResult, setTypingResult] = useState<TypingResult>(null);
  // FB39: local per-card flag, flips the "Spelling" button to a ✓ state once
  // tapped; resets whenever the card changes (via resetCardState).
  const [spellingAdded, setSpellingAdded] = useState(false);
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
    } else {
      setCurrentTopic(null);
      setTopicProgress(null);
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
    const activeWordIds = activeWords.map(w => w.id);
    const rows = useTopics
      ? await db.getDueCardsForWordIds(activeWordIds, QUEUE_POOL)
      : await db.getDueCardsForLevel(currentLevel, QUEUE_POOL);
    // FB77: today's remaining new-word budget (setting + "+5 new words" taps).
    // FB112-115: the badge shows the DAILY countdown, the queue intake pauses
    // separately when the half-learned pile hits the WIP ceiling.
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
    const items = applyCadence(capNewWords(buildQueue(rows, learned), intake), wordsOnly, learned);

    const streakData = await db.getStreak();
    setStreak(streakData.current_count);
    setQueue(items);
    setCurrentIndex(0);
    setRevealed(false);
    setReviewed(0);
    setTypedAnswer('');
    setTypingResult(null);
    setDone(items.length === 0);

    setCardStartTime(Date.now());
    setPracticeTyping(false);
    setPracticeResult(null);
    setPracticeText('');
    setLoading(false);
  };

  // FB77: raise today's new-word budget by 5 and rebuild the queue right away,
  // so the learner can keep going instead of waiting for tomorrow.
  const handleMoreNewWords = async () => {
    const db = getDb();
    await db.addNewLimitBonus(DAILY_NEW_BONUS_STEP);
    setLoading(true);
    await loadCards();
  };

  useEffect(() => {
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
          const tlang = ob?.target ?? 'es';
          const lvl = (await db.getLevel()).level as Level;
          const tp = tid ? getTopicsForLevel(lvl, tlang).find((t) => t.id === tid) : null;
          if (tp) {
            setTopicSwitchMsg(s.topic.switchToast(getTopicName(tp, tlang)));
            setTimeout(() => setTopicSwitchMsg(null), 3500);
          }
        })();
      }
    }, [])
  );

  const current = queue[currentIndex];

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
      if (prompt) Speech.speak(prompt, { language: speechLang(native) });
      return;
    }
    const { front, frontLang } = getFrontBack(current);
    if (front) Speech.speak(front, { language: speechLang(frontLang) });
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
    setTypingResult(null);
    setCardStartTime(Date.now());
    setPracticeTyping(false);
    setPracticeResult(null);
    setPracticeText('');
    setSpellingAdded(false);
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

    let newRows: any[];
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
        const s = t();
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
          setTopicCompleteMsg(
            closesSubLevel
              ? `${s.topic.complete}\n${s.subLevel.complete(sub.id, getSubLevelName(sub, lang))}`
              : s.topic.complete,
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
      const scopedWords = activeTopic
        ? [
            ...getWordsForTopic(currentLevel, activeTopic.id, learned),
            ...unlocked
              .filter(t => t.id !== activeTopic!.id)
              .flatMap(t => getWordsForTopic(currentLevel, t.id, learned))
              .filter((w: WordEntry) => (repsMap.get(w.id) ?? 0) > 0),
          ]
        : unlocked.flatMap(t => getWordsForTopic(currentLevel, t.id, learned));
      const activeWordIds = scopedWords.map((w: WordEntry) => w.id);
      for (const w of scopedWords) {
        await db.ensureCard(w.id, 'word');
        await db.ensureCard(w.id, 'sentence');
      }
      newRows = await db.getDueCardsForWordIds(activeWordIds, QUEUE_POOL);
    } else {
      newRows = await db.getDueCardsForLevel(currentLevel, QUEUE_POOL);
    }

    const wordsOnly2 = await db.getWordsOnly();
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
    const newItems = applyCadence(capNewWords(buildQueue(newRows, learned), intake2), wordsOnly2, learned);

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
    if (back) Speech.speak(back, { language: speechLang(backLang) });
    if (item.type !== 'word') return;
    const sentence = String(item.word[`sentence_${learned}`] ?? '');
    if (sentence) Speech.speak(sentence, { language: speechLang(learned) });
  };

  const handleCheck = () => {
    if (!current) return;
    // FB43: an empty answer isn't a wrong answer, it just means "not now" (too
    // hard / forgotten). Don't grade it, don't touch the fail streak. FB73: still
    // SHOW what the word would have been, then the → button sends the card to the
    // back of the queue (handleTypingNext). FB116: and read it out loud.
    if (typedAnswer.trim().length === 0) {
      setTypingResult('skipped');
      setRevealed(true);
      speakSkippedAnswer(current);
      return;
    }
    const { back } = getFrontBack(current);
    const correct = back.split(' / ')[0];

    // Strict (FB6): "she speak" must not pass for "She speaks", only case,
    // punctuation and missing accents are forgiven.
    const ok = strictAnswerMatch(typedAnswer, correct);
    setTypingResult(ok ? 'correct' : 'wrong');
    setRevealed(true);
    // FB90: the explanation is what a wrong answer needs, so open the "i" note by
    // itself after a miss (only then, a correct answer keeps the card quiet).
    if (!ok) setNoteOpen(true);
    // FB64: the recognition fallback is gone, so the answer is always read out
    // loud on reveal (nothing can cover the card any more).
    const { backLang } = getFrontBack(current);
    Speech.speak(back, { language: speechLang(backLang) });
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

  // Replaces the current card with its next-phase twin at the back of the queue
  // (same index bookkeeping as requeueCurrent, see its comment).
  const requeueAtPhase = (item: DueItem, card: Card, phase: WordPhase) => {
    const shape = phaseShape(phase);
    const nextItem: DueItem = { ...item, card, isTyping: shape.isTyping, typingDirection: shape.typingDirection };
    const rest = queue.filter((_, i) => i !== currentIndex);
    setQueue([...rest, nextItem]);
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
      <ExamMode
        level={examLevel ?? level}
        direction={direction as [string, string]}
        onLevelUp={(newLevel) => { setLevel(newLevel); setExamLevel(null); }}
        onExit={() => { setExamMode(false); setExamLevel(null); loadCards(); }}
      />
    );
  }

  if (done) {
    const examAvailable = getExamQuestionsFor(direction[1], level).length > 0 && masteredPct >= 80;
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
      />
    );
  }

  const { front, back, frontLang, backLang } = getFrontBack(current);
  const isWord = current.type === 'word';

  const speakTarget = () => {
    Speech.speak(back, { language: speechLang(backLang) });
  };

  const topicLang = direction[1] === 'hu' ? 'hu' : direction[1] === 'es' ? 'es' : direction[1] === 'de' ? 'de' : 'en';

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

  const levelBadge = (
    <View style={[styles.levelBadge, { backgroundColor: '#38BDF8' }]}>
      <Text style={styles.levelText} maxFontSizeMultiplier={HEADER_FONT_SCALE_CAP}>{level}</Text>
    </View>
  );

  // FB103: "nem tudom mikor fogy el a napi 5 új szó". The header carries the
  // count, so the budget is visible while learning, not only on the Done screen.
  const headerBadges = (
    <View style={styles.headerBadges}>
      <View style={[styles.streakBadge, { backgroundColor: colors.card }]}>
        <Text style={[styles.streakNumber, { color: colors.accent }]} maxFontSizeMultiplier={HEADER_FONT_SCALE_CAP}>{newWordsLeft}</Text>
        <Text style={styles.streakLabel} maxFontSizeMultiplier={HEADER_FONT_SCALE_CAP}>{newWordsPaused ? '🌱⏸' : '🌱'}</Text>
      </View>
      <View style={[styles.streakBadge, { backgroundColor: colors.card }]}>
        <Text style={[styles.streakNumber, { color: colors.accent }]} maxFontSizeMultiplier={HEADER_FONT_SCALE_CAP}>{streak}</Text>
        <Text style={[styles.streakLabel, { color: colors.tabIconDefault }]} maxFontSizeMultiplier={HEADER_FONT_SCALE_CAP}>🔥</Text>
      </View>
    </View>
  );

  const currentSubLevel = currentTopic ? getSubLevelForTopic(level, currentTopic.id, direction[1]) : null;
  const subLevelTopics = currentSubLevel ? getTopicsForSubLevel(level, currentSubLevel.id, direction[1]) : [];
  const subLevelPos = currentTopic ? subLevelTopics.findIndex((tp) => tp.id === currentTopic.id) + 1 : 0;

  const topicHeader = currentTopic && topicProgress ? (
    <>
      <Pressable style={styles.topicHeader} onPress={() => router.push('/(tabs)/tree')}>
        <Text
          style={[styles.topicIcon, { color: currentTopic.type === 'grammar' ? '#22C55E' : '#38BDF8' }]}
          maxFontSizeMultiplier={HEADER_FONT_SCALE_CAP}
        >
          {currentTopic.icon ?? (currentTopic.type === 'grammar' ? '📗' : '📘')}
        </Text>
        <Text
          style={[styles.topicName, { color: colors.text }]}
          numberOfLines={1}
          maxFontSizeMultiplier={HEADER_FONT_SCALE_CAP}
        >
          {getTopicName(currentTopic, topicLang)}
        </Text>
      </Pressable>
      {currentSubLevel && subLevelPos > 0 && (
        <Text
          style={[styles.subLevelLine, { color: colors.tabIconDefault }]}
          numberOfLines={1}
          maxFontSizeMultiplier={HEADER_FONT_SCALE_CAP}
          onLayout={(e) => {
            const { y, height } = e.nativeEvent.layout;
            const bottom = Math.max(HEADER_RESERVE_MIN, Math.ceil(y + height) + 8);
            setHeaderBottom((prev) => (prev === bottom ? prev : bottom));
          }}
        >
          {s.subLevel.progress(currentSubLevel.id, getSubLevelName(currentSubLevel, topicLang), subLevelPos, subLevelTopics.length)}
        </Text>
      )}
    </>
  ) : null;

  const targetLangInfo = languages.find(l => l.code === direction[1]);
  const progressMeter = (
    <ProgressMeter
      known={knownWords}
      total={levelTotal}
      langFlag={targetLangInfo?.flag ?? ''}
      langName={targetLangInfo?.name ?? ''}
    />
  );

  const examBanner = masteredPct >= 80 ? (
    <Pressable style={styles.examBanner} onPress={() => setExamMode(true)}>
      <Text style={styles.examBannerTitle}>{s.exam.unlocked}</Text>
      <Text style={styles.examBannerCta}>{s.exam.unlockedCta} →</Text>
    </Pressable>
  ) : null;

  const bannerMsg = topicCompleteMsg ?? topicSwitchMsg;
  const topicCompleteOverlay = bannerMsg ? (
    <Pressable style={[styles.levelUpOverlay, { backgroundColor: topicCompleteMsg ? '#22C55E' : '#2563EB' }]} onPress={() => router.push('/(tabs)/tree')}>
      <Text style={styles.levelUpText}>{bannerMsg}</Text>
      {topicCompleteMsg && hasTopics(level, direction[1]) && <Text style={[styles.levelUpText, { fontSize: 11 }]}>{s.topic.chooseTopic} →</Text>}
    </Pressable>
  ) : null;

  const levelUpOverlay = levelUpMsg ? (
    <View style={[styles.levelUpOverlay, { backgroundColor: levelUpMsg.startsWith('↑') ? '#2563EB' : '#EF4444' }]}>
      <Text style={styles.levelUpText}>{levelUpMsg}</Text>
    </View>
  ) : null;

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
        {levelUpOverlay}
        {topicCompleteOverlay}
        <View style={styles.header}>
          {levelBadge}
          {headerBadges}
        </View>
        {/* FB87: same collapse as FB74 on the typing screen, a long sentence
            with many chips grows past the centered column and slides under the
            absolute header. Scroll the card instead (shared scroll styles). */}
        <ScrollView
          style={styles.typingScroll}
          contentContainerStyle={[styles.typingScrollContent, { paddingTop: headerBottom }]}
          keyboardShouldPersistTaps="handled"
        >
        {topicHeader}
        {progressMeter}
        {examBanner}

        <EasySentenceCard
          key={`${current.wordId}-${currentIndex}`}
          sourceSentence={nativeSentence}
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
        {levelUpOverlay}
        {topicCompleteOverlay}
        <View style={styles.header}>
          {levelBadge}
          {headerBadges}
        </View>
        {/* FB74: once the result block appears the card grows, and a centered,
            non-scrolling column pushed the top of the card under the absolute
            header. Scroll instead, so nothing collides on small screens. */}
        <ScrollView
          style={styles.typingScroll}
          contentContainerStyle={[styles.typingScrollContent, { paddingTop: headerBottom }]}
          keyboardShouldPersistTaps="handled"
        >
        {topicHeader}
        {progressMeter}
        {examBanner}

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={[styles.frontRow, { marginBottom: 16 }]}>
            {iconBadge}
            <Text style={[styles.frontText, { color: colors.text }]}>{front}</Text>
            <Pressable onPress={() => Speech.speak(front, { language: speechLang(frontLang) })} style={styles.speakBtn}>
              <Text style={styles.speakIcon}>🔊</Text>
            </Pressable>
            {noteButton}
          </View>
          {photoBlock}
          {noteBlock}

          {/* FB5: inline action button — with softwareKeyboardLayoutMode "pan"
              the bottom Check button can sit under the open keyboard, so the
              input row carries its own always-visible ✓/→. */}
          <View style={styles.inputRow}>
            <TextInput
              ref={inputRef}
              style={[styles.input, { flex: 1, width: 'auto', color: colors.text, borderColor: typingResult ? resultColor : colors.tabIconDefault }]}
              placeholder={s.card.typeTranslation}
              placeholderTextColor={colors.tabIconDefault}
              value={typedAnswer}
              onChangeText={setTypedAnswer}
              onSubmitEditing={revealed ? handleTypingNext : handleCheck}
              editable={!revealed}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable
              style={[styles.inlineCheckBtn, { backgroundColor: revealed && typingResult === 'wrong' ? '#1D4ED8' : '#38BDF8' }]}
              onPress={revealed ? handleTypingNext : handleCheck}
            >
              <Text style={styles.inlineCheckText}>{revealed ? '→' : '✓'}</Text>
            </Pressable>
          </View>

          {revealed && (
            <View style={styles.resultSection}>
              <Text style={[styles.resultText, { color: resultColor }]}>{resultText}</Text>
              {typingResult === 'wrong' && typedAnswer.trim().length > 0 && (
                <Text style={styles.diffLine}>
                  {charDiff(typedAnswer, back.split(' / ')[0]).map((d, i) => (
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
                <Text style={[styles.correctAnswer, { color: colors.tint }]}>{back}</Text>
                <Pressable onPress={speakTarget} style={styles.speakBtn}>
                  <Text style={styles.speakIcon}>🔊</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        {!revealed ? (
          <View style={styles.buttons}>
            <Pressable
              style={[styles.button, styles.checkButton, { backgroundColor: '#38BDF8' }]}
              onPress={handleCheck}
            >
              <Text style={styles.buttonText}>{s.card.check}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.buttons}>
            <Pressable
              style={[styles.button, styles.checkButton, { backgroundColor: typingResult === 'wrong' ? '#1D4ED8' : '#38BDF8' }]}
              onPress={handleTypingNext}
            >
              <Text style={styles.buttonText}>→</Text>
            </Pressable>
          </View>
        )}

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

        <FeedbackButton level={level} languagePair={direction.join('→')} currentCard={`${current.type}:${front}`} />
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {levelUpOverlay}
      {topicCompleteOverlay}
      <View style={styles.header}>
        {levelBadge}
        {headerBadges}
      </View>
      {/* FB102: same collapse as FB74/FB87, one screen lower. Opening the ℹ️
          note grows the card past the centered column, and the fixed content
          slid under the absolutely positioned header ("az A1 és a tűz jel a
          számmal megmarad és jön le és így egybe bugolódik"). Scroll instead. */}
      <ScrollView
        style={styles.typingScroll}
        contentContainerStyle={[styles.typingScrollContent, { paddingTop: headerBottom }]}
        keyboardShouldPersistTaps="handled"
      >
      {topicHeader}
      {progressMeter}
      {examBanner}

      <Pressable
        style={[styles.card, { backgroundColor: colors.card }]}
        onPress={() => {
          if (!revealed) {
            setRevealed(true);
            // FB116: read the answer in whichever language it is, English included.
            Speech.speak(back, { language: speechLang(backLang) });
          }
        }}
      >
        <View style={styles.frontRow}>
          {iconBadge}
          <Text style={[styles.frontText, { color: colors.text }]}>{front}</Text>
          <Pressable onPress={() => Speech.speak(front, { language: speechLang(frontLang) })} style={styles.speakBtn}>
            <Text style={styles.speakIcon}>🔊</Text>
          </Pressable>
          {noteButton}
        </View>
        {photoBlock}
        {noteBlock}

        {revealed ? (
          <View style={styles.backSection}>
            <View style={[styles.divider, { backgroundColor: '#38BDF8' }]} />
            <View style={styles.frontRow}>
              <Text style={[styles.backText, { color: colors.tint }]}>{back}</Text>
              <Pressable onPress={speakTarget} style={styles.speakBtn}>
                <Text style={styles.speakIcon}>🔊</Text>
              </Pressable>
            </View>
            {!practiceTyping && !practiceResult && (
              <Pressable
                style={[styles.typeItBtn, { borderColor: colors.tabIconDefault }]}
                onPress={() => setPracticeTyping(true)}
              >
                <Text style={[styles.typeItText, { color: colors.tabIconDefault }]}>✏️ {s.card.typeIt}</Text>
              </Pressable>
            )}
            {practiceTyping && !practiceResult && (
              <View style={styles.practiceSection}>
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.tabIconDefault }]}
                  placeholder={s.card.typeTranslation}
                  placeholderTextColor={colors.tabIconDefault}
                  value={practiceText}
                  onChangeText={setPracticeText}
                  onSubmitEditing={() => {
                    setPracticeResult(strictAnswerMatch(practiceText, back.split(' / ')[0]) ? 'correct' : 'wrong');
                  }}
                  autoFocus
                  autoCapitalize="none"
                  autoCorrect={false}
                />
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'absolute',
    top: 16,
    left: 20,
    right: 20,
  },
  levelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  levelText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  levelUpOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    zIndex: 100,
  },
  levelUpText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  streakNumber: {
    fontSize: 18,
    fontWeight: '700',
  },
  streakLabel: {
    fontSize: 14,
  },
  counter: {
    fontSize: 14,
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
  checkButton: {
    minWidth: 200,
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
  inputRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineCheckBtn: {
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 14,
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
  typingScroll: {
    flex: 1,
    width: '100%',
  },
  typingScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingTop: 56,
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
  topicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    position: 'absolute',
    top: 44,
    left: 20,
    right: 20,
    justifyContent: 'center',
  },
  topicIcon: {
    fontSize: 14,
    lineHeight: 18,
  },
  subLevelLine: {
    position: 'absolute',
    top: 66,
    left: 20,
    right: 20,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '500',
  },
  topicName: {
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
    lineHeight: 18,
  },
  topicCount: {
    fontSize: 12,
    fontWeight: '500',
  },
  examBanner: {
    backgroundColor: '#F59E0B',
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  examBannerTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  examBannerCta: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
