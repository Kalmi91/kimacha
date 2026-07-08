import { useEffect, useState, useRef, useCallback } from 'react';
import { StyleSheet, Text, View, Pressable, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { fsrs, Rating, type Card, type Grade } from 'ts-fsrs';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { getDb, cardFromRow } from '@/lib/database';
import { words, type WordEntry, getWordsForLevel, getWordsForTopic, getWordTopic, LEVELS, type Level } from '@/data/words';
import { getTopicsForLevel, hasTopics, getTopicName, getSubLevelForTopic, getTopicsForSubLevel, getSubLevelName, type TopicDef } from '@/data/topics';
import { t } from '@/lib/i18n';
import { strictAnswerMatch } from '@/lib/answerMatch';
import { nearMissDistractors } from '@/lib/distractors';
import { spellingVariants } from '@/lib/spellingVariants';
import { shuffleOptions, hashString } from '@/lib/shuffle';
import { consumePendingAction } from '@/lib/pendingAction';
import FeedbackButton from '@/components/FeedbackModal';
import * as Speech from 'expo-speech';
import ExamMode from '@/components/ExamMode';
import DoneScreen from '@/components/DoneScreen';
import EasySentenceCard from '@/components/EasySentenceCard';
import ProgressMeter from '@/components/ProgressMeter';
import { languages, speechLang } from '@/lib/languages';
import { getExamQuestionsFor } from '@/data/exams';

const f = fsrs();

type TypingDir = 'learned-to-native' | 'native-to-learned';

interface DueItem {
  wordId: number;
  type: string;
  card: Card;
  word: WordEntry;
  isTyping: boolean;
  isEasySentence?: boolean;
  typingDirection?: TypingDir;
}

type TypingResult = 'correct' | 'almost' | 'wrong' | null;

// FB25: char-level diff for typing answers, highlights the mistyped letters.
// LCS alignment so one missing/extra letter doesn't cascade the whole word red.
// Comparison folds case + accents (those are forgiven by strictAnswerMatch),
// but the user's original characters are rendered.
const foldChar = (ch: string): string =>
  ch.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function charDiff(typed: string, correct: string): { ch: string; wrong: boolean }[] {
  const a = [...typed];
  const b = [...correct];
  const an = a.map(foldChar);
  const bn = b.map(foldChar);
  const m = an.length, n = bn.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = an[i] === bn[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: { ch: string; wrong: boolean }[] = [];
  let i = 0, j = 0;
  while (i < m) {
    if (j < n && an[i] === bn[j]) {
      out.push({ ch: a[i], wrong: false }); i++; j++;
    } else if (j < n && dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ ch: a[i], wrong: true }); i++;       // typed char not in correct
    } else if (j < n) {
      j++;                                            // correct has a char typed missed
    } else {
      out.push({ ch: a[i], wrong: true }); i++;       // trailing extra typed chars
    }
  }
  return out;
}

// FB26: reorder word cards so no more than `maxRun` of the same kind (flashcard
// vs typing) appear in a row, keeping a balanced flashcard/typing mix.
function interleaveByType(items: DueItem[], maxRun: number): DueItem[] {
  const flash = items.filter((i) => !i.isTyping);
  const typing = items.filter((i) => i.isTyping);
  const out: DueItem[] = [];
  let fi = 0, ti = 0;
  let last: boolean | null = null;
  let run = 0;
  while (fi < flash.length || ti < typing.length) {
    let pullTyping: boolean;
    if (fi >= flash.length) pullTyping = true;
    else if (ti >= typing.length) pullTyping = false;
    else if (last !== null && run >= maxRun) pullTyping = !last; // force a switch
    else pullTyping = (typing.length - ti) > (flash.length - fi); // pull from the fuller bucket
    const item: DueItem = pullTyping ? typing[ti++] : flash[fi++];
    out.push(item);
    if (item.isTyping === last) run++;
    else { run = 1; last = item.isTyping; }
  }
  return out;
}

const foldStr = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// FB44+FB48: HYBRID 2+1 recognition options. Two REAL words (not misspellings)
// from the level's vocabulary, preferring the current word's topic, so the
// wrong options are obviously different words rather than near-identical
// spelling noise. Deterministic (seeded by wordId) so re-renders are stable.
function pickRecogRealWords(
  wordId: number,
  correct: string,
  level: Level,
  learned: string,
  count: number,
): string[] {
  const currentWord = words.find((w) => w.id === wordId);
  const topic = currentWord ? getWordTopic(currentWord) : undefined;
  const levelWords = getWordsForLevel(level, learned).filter((w) => w.id !== wordId);
  const sameTopic = topic ? levelWords.filter((w) => getWordTopic(w) === topic) : [];

  const seen = new Set<string>([foldStr(correct)]);
  const candidates: string[] = [];
  for (const pool of [sameTopic, levelWords]) {
    for (const w of pool) {
      const value = String(w[learned]).split(' / ')[0];
      const key = foldStr(value);
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push(value);
    }
  }

  const next = rng32(hashString(`${wordId}:realwords`));
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  return candidates.slice(0, count);
}

/** mulberry32 PRNG, mirrors the seeded RNG in lib/spellingVariants.ts. */
function rng32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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
  const [direction, setDirection] = useState<[string, string]>(['es', 'hu']);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [typingResult, setTypingResult] = useState<TypingResult>(null);
  // FB28: which spelling options were tapped wrong on the recognition fallback.
  const [recogWrongPicks, setRecogWrongPicks] = useState<string[]>([]);
  // FB45: recog card resolution, first tap reveals correct/wrong via color,
  // second tap (on any option) advances the card.
  const [recogResolved, setRecogResolved] = useState<'correct' | 'wrong' | null>(null);
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
  // FB28: per-word consecutive typing failures this session. At >= RECOGNITION_AT
  // the word's typing card downgrades to a multiple-choice "pick the correct
  // spelling" card (recognition fallback) so a stuck learner can still progress.
  const failsRef = useRef(new Map<number, number>());
  const RECOGNITION_AT = 2;

  const buildQueue = (rows: any[]): DueItem[] => {
    return rows.map((row: any) => {
      const isWord = row.type === 'word';
      const isSentence = row.type === 'sentence';
      let isTyping = false;
      let typingDirection: TypingDir | undefined;

      if (isWord) {
        if (row.reps >= 2) {
          // Phase 2: typing native→learned
          isTyping = true;
          typingDirection = 'native-to-learned';
        } else if (row.reps === 1) {
          // Phase 1b: flashcard native→learned (passive)
          isTyping = false;
          typingDirection = 'native-to-learned';
        }
        // reps === 0: Phase 1a: flashcard learned→native (default direction)
      } else {
        // Sentence: easy (tap-to-order) first time, hard (typing) after
        isTyping = row.reps > 0;
      }

      return {
        wordId: row.word_id,
        type: row.type,
        card: cardFromRow(row),
        word: words.find(w => w.id === row.word_id)!,
        isTyping,
        isEasySentence: isSentence && row.reps === 0,
        typingDirection,
      };
    }).filter((item: DueItem) => !!item.word);
  };

  const QUEUE_POOL = 40;

  const applyCadence = (items: DueItem[], wordsOnly: boolean): DueItem[] => {
    if (wordsOnly) {
      // FB24/26/27: words only, no sentences. Respect each word's natural phase
      // (flashcard L→N at reps0, flashcard N→L at reps1, typing N→L at reps>=2),
      // so a word becomes a typing card ONLY after it reached Good in BOTH
      // flashcard directions. Interleave so no >4 cards of one kind run, and the
      // first card is always a word flashcard (never a sentence build).
      const wordItems = items.filter((item) => item.type === 'word');
      return interleaveByType(wordItems, 4);
    }
    // FB31/FB36: repeating 4-words + 1-sentence unit (80% word / 20% sentence).
    // Sentence slots cycle easy → easy → typing on a counter that runs across
    // the whole queue, so the 2:1 easy:typing mix survives unit boundaries and
    // two sentence cards are never adjacent while words remain.
    const words: DueItem[] = [];
    const easy: DueItem[] = [];
    const typing: DueItem[] = [];
    for (const item of items) {
      if (item.type === 'word') words.push(item);
      else if (item.isEasySentence) easy.push(item);
      else typing.push(item);
    }
    // FB33/FB35: easy sentences come simplest-first (learned-language word
    // count, then character length; stable). Typing sentences are due FSRS
    // reviews, so their order stays untouched.
    const sentOf = (item: DueItem) => String(item.word[`sentence_${direction[1]}`]).trim();
    easy.sort((a, b) => {
      const sa = sentOf(a), sb = sentOf(b);
      const wa = sa.split(/\s+/).filter(Boolean).length;
      const wb = sb.split(/\s+/).filter(Boolean).length;
      return wa - wb || sa.length - sb.length;
    });
    const result: DueItem[] = [];
    let wi = 0, ei = 0, ti = 0, slot = 0;
    while (wi < words.length) {
      const batch = words.slice(wi, wi + 4);
      wi += batch.length;
      result.push(...batch);
      if (ei >= easy.length && ti >= typing.length) continue; // no sentences left, words go on
      const wantTyping = slot % 3 === 2;
      slot++;
      // an empty scheduled bucket falls back to the other, no due sentence dropped
      if (wantTyping ? ti < typing.length : ei >= easy.length) { result.push(typing[ti]); ti++; }
      else { result.push(easy[ei]); ei++; }
    }
    // words exhausted: alternate remaining easy/typing so neither kind dumps
    // in one long run (FB31)
    let takeEasy = true;
    while (ei < easy.length || ti < typing.length) {
      if (takeEasy ? ei < easy.length : ti >= typing.length) { result.push(easy[ei]); ei++; }
      else { result.push(typing[ti]); ti++; }
      takeEasy = !takeEasy;
    }
    return result;
  };

  const computeUnlockedTopics = (topics: TopicDef[], repsMap: Map<number, number>, currentLevel: Level, selectedTopicId?: string | null, lang: string = 'es', randomPick: boolean = false): { unlocked: TopicDef[]; activeTopic: TopicDef | null; completedCount: number } => {
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

    let completedCount = 0;
    for (const topic of unlocked) {
      const topicWords = getWordsForTopic(currentLevel, topic.id, lang);
      if (topicWords.length > 0 && topicWords.every(w => (repsMap.get(w.id) ?? 0) > 0)) {
        completedCount++;
      }
    }

    // Active topic: use persisted selectedTopic if set and not fully complete,
    // otherwise fall back to first incomplete topic by order.
    let activeTopic: TopicDef | null = null;
    if (selectedTopicId) {
      const sel = unlocked.find(t => t.id === selectedTopicId);
      if (sel) {
        const selWords = getWordsForTopic(currentLevel, sel.id, lang);
        const selComplete = selWords.length > 0 && selWords.every(w => (repsMap.get(w.id) ?? 0) > 0);
        if (!selComplete) activeTopic = sel;
      }
    }
    if (!activeTopic) {
      const isIncomplete = (topic: TopicDef) => {
        const topicWords = getWordsForTopic(currentLevel, topic.id, lang);
        return topicWords.some(w => (repsMap.get(w.id) ?? 0) === 0);
      };
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
      const savedTopic = await db.getSelectedTopic();
      const randomTopics = await db.getRandomTopics();
      const { unlocked, activeTopic, completedCount } = computeUnlockedTopics(topics, repsMap, currentLevel, savedTopic, learned, randomTopics);
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
        wordsReviewed: activeTopic ? getWordsForTopic(currentLevel, activeTopic.id, learned).filter(w => (repsMap.get(w.id) ?? 0) > 0).length : 0,
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
    const items = applyCadence(buildQueue(rows), wordsOnly);

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

  useEffect(() => {
    if (!current || loading || done) return;
    const [, learned] = direction;
    // Easy sentence (tap-to-order): the learned-language sentence IS the answer the
    // user must assemble, so don't auto-read it aloud, that would reveal the solution.
    if (current.isEasySentence) return;
    const { frontLang } = getFrontBack(current);
    if (frontLang === learned) {
      const frontText = String(current.word[current.type === 'word' ? learned : `sentence_${learned}`]);
      Speech.speak(frontText, { language: speechLang(learned) });
    }
  }, [currentIndex, queue.length, loading, done]);

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
    setRecogWrongPicks([]);
    setRecogResolved(null);
    setCardStartTime(Date.now());
    setPracticeTyping(false);
    setPracticeResult(null);
    setPracticeText('');
  };

  const advance = async (rating: Grade) => {
    if (!current || advancingRef.current) return;
    advancingRef.current = true;

    // Capture the rated card before any optimistic UI change.
    const item = current;
    const startTime = cardStartTime;
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
        const savedTopic2 = await db.getSelectedTopic();
        const randomTopics2 = await db.getRandomTopics();
        const { unlocked, activeTopic, completedCount } = computeUnlockedTopics(topics, repsMap, currentLevel, savedTopic2, learned, randomTopics2);
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
            // complete (free ordering — cannot rely on "last topic" position).
            const sub = getSubLevelForTopic(currentLevel, prevCompleted.id, learned);
            const subTopics = sub ? getTopicsForSubLevel(currentLevel, sub.id, learned) : [];
            const closesSubLevel = sub && subTopics.length > 0 && subTopics.every(st => {
              const stWords = getWordsForTopic(currentLevel, st.id, learned);
              return stWords.length > 0 && stWords.every(w => (repsMap.get(w.id) ?? 0) > 0);
            });
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
          wordsReviewed: activeTopic ? getWordsForTopic(currentLevel, activeTopic.id, learned).filter(w => (repsMap.get(w.id) ?? 0) > 0).length : 0,
        });

        const activeWordIds = unlocked.flatMap(topic => getWordsForTopic(currentLevel, topic.id, learned)).map(w => w.id);
        for (const w of unlocked.flatMap(topic => getWordsForTopic(currentLevel, topic.id, learned))) {
          await db.ensureCard(w.id, 'word');
          await db.ensureCard(w.id, 'sentence');
        }
        newRows = await db.getDueCardsForWordIds(activeWordIds, QUEUE_POOL);
      } else {
        newRows = await db.getDueCardsForLevel(currentLevel, QUEUE_POOL);
      }

      const wordsOnly2 = await db.getWordsOnly();
      const newItems = applyCadence(buildQueue(newRows), wordsOnly2);

      if (newItems.length === 0) {
        setDone(true);
      } else {
        setQueue(newItems);
        setCurrentIndex(0);
      }
      resetCardState();
    }
    } finally {
      if (!midQueue) advancingRef.current = false;
    }
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

  const handleCheck = () => {
    if (!current) return;
    const { back } = getFrontBack(current);
    const correct = back.split(' / ')[0];

    // Strict (FB6): "she speak" must not pass for "She speaks", only case,
    // punctuation and missing accents are forgiven.
    const ok = strictAnswerMatch(typedAnswer, correct);
    setTypingResult(ok ? 'correct' : 'wrong');
    // FB28: track per-word failures so a repeatedly-missed word drops to the
    // recognition fallback; a correct answer clears the streak.
    if (current.type === 'word') {
      const fails = failsRef.current;
      if (ok) fails.delete(current.wordId);
      else fails.set(current.wordId, (fails.get(current.wordId) ?? 0) + 1);
    }
    setRevealed(true);
    // FB32: the recognition fallback (spelling options) is about to appear on
    // this same render, don't read the answer out loud while the options are visible.
    const showsRecognitionFallback =
      current.type === 'word' && !ok && (failsRef.current.get(current.wordId) ?? 0) >= RECOGNITION_AT;
    if (!showsRecognitionFallback) {
      const { backLang } = getFrontBack(current);
      Speech.speak(back, { language: speechLang(backLang) });
    }
  };

  const handleTypingNext = () => {
    if (typingResult === 'wrong') {
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
      />
    );
  }

  const { front, back, frontLang, backLang } = getFrontBack(current);
  const isWord = current.type === 'word';

  const speakTarget = () => {
    Speech.speak(back, { language: speechLang(backLang) });
  };

  const topicLang = direction[1] === 'hu' ? 'hu' : direction[1] === 'es' ? 'es' : direction[1] === 'de' ? 'de' : 'en';

  const levelBadge = (
    <View style={[styles.levelBadge, { backgroundColor: '#38BDF8' }]}>
      <Text style={styles.levelText}>{level}</Text>
    </View>
  );

  const currentSubLevel = currentTopic ? getSubLevelForTopic(level, currentTopic.id, direction[1]) : null;
  const subLevelTopics = currentSubLevel ? getTopicsForSubLevel(level, currentSubLevel.id, direction[1]) : [];
  const subLevelPos = currentTopic ? subLevelTopics.findIndex((tp) => tp.id === currentTopic.id) + 1 : 0;

  const topicHeader = currentTopic && topicProgress ? (
    <>
      <Pressable style={styles.topicHeader} onPress={() => router.push('/(tabs)/tree')}>
        <Text style={[styles.topicIcon, { color: currentTopic.type === 'grammar' ? '#22C55E' : '#38BDF8' }]}>
          {currentTopic.icon ?? (currentTopic.type === 'grammar' ? '📗' : '📘')}
        </Text>
        <Text style={[styles.topicName, { color: colors.text }]} numberOfLines={1}>
          {getTopicName(currentTopic, topicLang)}
        </Text>
      </Pressable>
      {currentSubLevel && subLevelPos > 0 && (
        <Text style={[styles.subLevelLine, { color: colors.tabIconDefault }]} numberOfLines={1}>
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
          <View style={[styles.streakBadge, { backgroundColor: colors.card }]}>
            <Text style={[styles.streakNumber, { color: colors.accent }]}>{streak}</Text>
            <Text style={[styles.streakLabel, { color: colors.tabIconDefault }]}>🔥</Text>
          </View>
        </View>
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
        />
        <FeedbackButton level={level} languagePair={direction.join('→')} currentCard={`easy:${nativeSentence}`} />
      </View>
    );
  }

  // FB28: recognition fallback, a word missed >= RECOGNITION_AT times this
  // session becomes "pick the correct spelling" (correct form + plausible
  // misspellings) so a stuck learner can still clear it.
  // Reading failsRef in render is safe here: every mutation of the map is
  // immediately followed by a state update (handleCheck sets revealed/result,
  // handleRecogPick advances the card), so a re-render always observes it.
  // eslint-disable-next-line react-hooks/refs
  if (isWord && current.isTyping && (failsRef.current.get(current.wordId) ?? 0) >= RECOGNITION_AT) {
    const correct = back.split(' / ')[0];
    // FB44+FB48: HYBRID 2+1, 1 correct + 2 real level words (obviously
    // different, preferring the current topic) + 1 careful spelling variant.
    const learned = direction[1];
    const realWords = pickRecogRealWords(current.wordId, correct, level, learned, 2);
    const options = shuffleOptions(
      [correct, ...realWords, ...spellingVariants(correct, 1)],
      0,
      hashString(`${current.wordId}:${correct}`),
    ).options;
    // FB45: first tap resolves (green on correct, red on a wrong tap) without
    // advancing; the NEXT tap on any option advances with the earned rating.
    const handleRecogPick = (option: string) => {
      if (recogResolved) {
        if (recogResolved === 'correct') {
          failsRef.current.delete(current.wordId);
          advance(Rating.Good);
        } else {
          advance(Rating.Again);
        }
        return;
      }
      if (strictAnswerMatch(option, correct)) {
        setRecogResolved('correct');
      } else {
        setRecogWrongPicks((prev) => [...prev, option]);
        setRecogResolved('wrong');
      }
    };
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {levelUpOverlay}
        {topicCompleteOverlay}
        <View style={styles.header}>
          {levelBadge}
          <View style={[styles.streakBadge, { backgroundColor: colors.card }]}>
            <Text style={[styles.streakNumber, { color: colors.accent }]}>{streak}</Text>
            <Text style={[styles.streakLabel, { color: colors.tabIconDefault }]}>🔥</Text>
          </View>
        </View>
        {topicHeader}
        {progressMeter}
        {examBanner}

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={[styles.frontRow, { marginBottom: 8 }]}>
            <Text style={[styles.frontText, { color: colors.text }]}>{front}</Text>
            <Pressable onPress={() => Speech.speak(front, { language: speechLang(frontLang) })} style={styles.speakBtn}>
              <Text style={styles.speakIcon}>🔊</Text>
            </Pressable>
          </View>
          <Text style={[styles.recogPrompt, { color: colors.tabIconDefault }]}>{s.card.pickSpelling}</Text>
          <View style={styles.recogOptions}>
            {options.map((opt) => {
              const wrong = recogWrongPicks.includes(opt);
              // FB45: the correct option turns green once resolved, whether it
              // was the tapped option (resolved: correct) or revealed after a
              // wrong tap (resolved: wrong), the learner always sees the answer.
              const green = !!recogResolved && opt === correct;
              return (
                <Pressable
                  key={opt}
                  onPress={() => handleRecogPick(opt)}
                  style={[
                    styles.recogOption,
                    { borderColor: colors.tabIconDefault, backgroundColor: colors.background },
                    wrong && { backgroundColor: '#EF4444', borderColor: '#EF4444', opacity: 0.6 },
                    green && { backgroundColor: '#22C55E', borderColor: '#22C55E' },
                  ]}
                >
                  <Text style={[styles.recogOptionText, { color: wrong || green ? '#FFFFFF' : colors.text }]}>{opt}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

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

        <FeedbackButton level={level} languagePair={direction.join('→')} currentCard={`recog:${front}`} />
      </View>
    );
  }

  if (current.isTyping) {
    const resultColor = typingResult === 'correct' ? '#22C55E' : typingResult === 'almost' ? '#EAB308' : '#EF4444';
    const resultText = typingResult === 'correct' ? s.card.correct : typingResult === 'almost' ? s.card.almostCorrect : s.card.wrong;

    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {levelUpOverlay}
        {topicCompleteOverlay}
        <View style={styles.header}>
          {levelBadge}
          <View style={[styles.streakBadge, { backgroundColor: colors.card }]}>
            <Text style={[styles.streakNumber, { color: colors.accent }]}>{streak}</Text>
            <Text style={[styles.streakLabel, { color: colors.tabIconDefault }]}>🔥</Text>
          </View>
        </View>
        {topicHeader}
        {progressMeter}
        {examBanner}

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={[styles.frontRow, { marginBottom: 16 }]}>
            <Text style={[styles.frontText, { color: colors.text }]}>{front}</Text>
            <Pressable onPress={() => Speech.speak(front, { language: speechLang(frontLang) })} style={styles.speakBtn}>
              <Text style={styles.speakIcon}>🔊</Text>
            </Pressable>
          </View>

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
                    <Text key={i} style={d.wrong ? styles.diffWrong : { color: colors.text }}>{d.ch}</Text>
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
        <View style={[styles.streakBadge, { backgroundColor: colors.card }]}>
          <Text style={[styles.streakNumber, { color: colors.accent }]}>{streak}</Text>
          <Text style={[styles.streakLabel, { color: colors.tabIconDefault }]}>🔥</Text>
        </View>
      </View>
      {topicHeader}
      {progressMeter}
      {examBanner}

      <Pressable
        style={[styles.card, { backgroundColor: colors.card }]}
        onPress={() => {
          if (!revealed) {
            setRevealed(true);
            const [, learned] = direction;
            if (backLang === learned) {
              Speech.speak(back, { language: speechLang(backLang) });
            }
          }
        }}
      >
        <View style={styles.frontRow}>
          <Text style={[styles.frontText, { color: colors.text }]}>{front}</Text>
          <Pressable onPress={() => Speech.speak(front, { language: speechLang(frontLang) })} style={styles.speakBtn}>
            <Text style={styles.speakIcon}>🔊</Text>
          </Pressable>
        </View>

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
        <Pressable
          style={[styles.button, { backgroundColor: '#1D4ED8' }]}
          onPress={() => advance(Rating.Again)}
        >
          <Text style={styles.buttonText}>{s.buttons.again}</Text>
        </Pressable>
        <Pressable
          style={[styles.button, { backgroundColor: '#38BDF8' }]}
          onPress={() => advance(Rating.Good)}
        >
          <Text style={styles.buttonText}>{s.buttons.good}</Text>
        </Pressable>
        {isWord && (
          <Pressable
            style={[styles.button, { backgroundColor: colors.accent }]}
            onPress={handleInSentence}
          >
            <Text style={styles.buttonText}>{s.buttons.inSentence}</Text>
          </Pressable>
        )}
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
  frontRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  recogPrompt: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  recogOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  recogOption: {
    width: '48%',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recogOptionText: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
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
  },
  subLevelLine: {
    position: 'absolute',
    top: 64,
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
