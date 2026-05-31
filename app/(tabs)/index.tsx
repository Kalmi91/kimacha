import { useEffect, useState, useRef, useCallback } from 'react';
import { StyleSheet, Text, View, Pressable, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { fsrs, Rating, type Card, type Grade } from 'ts-fsrs';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { getDb, cardFromRow } from '@/lib/database';
import { words, type WordEntry, getWordsForLevel, getWordsForTopic, LEVELS, type Level } from '@/data/words';
import { getTopicsForLevel, hasTopics, getTopicName, type TopicDef } from '@/data/topics';
import { t } from '@/lib/i18n';
import { levenshtein } from '@/lib/levenshtein';
import { consumePendingAction } from '@/lib/pendingAction';
import FeedbackButton from '@/components/FeedbackModal';
import * as Speech from 'expo-speech';
import ExamMode from '@/components/ExamMode';
import DoneScreen from '@/components/DoneScreen';
import EasySentenceCard from '@/components/EasySentenceCard';
import ProgressMeter from '@/components/ProgressMeter';
import { languages } from '@/lib/languages';
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

export default function LearnScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();

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
  const [level, setLevel] = useState<Level>('A0');
  const [levelUpMsg, setLevelUpMsg] = useState<string | null>(null);
  const [cardStartTime, setCardStartTime] = useState<number>(Date.now());
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
  const inputRef = useRef<TextInput>(null);

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

  const computeUnlockedTopics = (topics: TopicDef[], repsMap: Map<number, number>, currentLevel: Level): { unlocked: TopicDef[]; activeTopic: TopicDef | null; completedCount: number } => {
    const unlocked: TopicDef[] = [];
    let completedCount = 0;
    for (const topic of topics) {
      const topicWords = getWordsForTopic(currentLevel, topic.id);
      if (unlocked.length === 0) {
        unlocked.push(topic);
      } else {
        const prevTopic = topics[topics.indexOf(topic) - 1];
        const prevWords = getWordsForTopic(currentLevel, prevTopic.id);
        const allReviewed = prevWords.length > 0 && prevWords.every(w => (repsMap.get(w.id) ?? 0) > 0);
        if (allReviewed) {
          unlocked.push(topic);
        } else {
          break;
        }
      }
    }
    for (const topic of unlocked) {
      const topicWords = getWordsForTopic(currentLevel, topic.id);
      if (topicWords.length > 0 && topicWords.every(w => (repsMap.get(w.id) ?? 0) > 0)) {
        completedCount++;
      }
    }
    const activeTopic = unlocked.find(topic => {
      const topicWords = getWordsForTopic(currentLevel, topic.id);
      return topicWords.some(w => (repsMap.get(w.id) ?? 0) === 0);
    }) ?? unlocked[unlocked.length - 1] ?? null;

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

    const levelWords = getWordsForLevel(currentLevel);
    const topics = getTopicsForLevel(currentLevel);
    const useTopics = topics.length > 0 && levelWords.some(w => w['topic']);

    let activeWords: WordEntry[];
    if (useTopics) {
      const allWordIds = levelWords.map(w => w.id);
      const repsMap = await db.getWordReps(allWordIds);
      const { unlocked, activeTopic, completedCount } = computeUnlockedTopics(topics, repsMap, currentLevel);

      setCurrentTopic(activeTopic);
      setTopicProgress({
        done: completedCount,
        total: topics.length,
        wordsInTopic: activeTopic ? getWordsForTopic(currentLevel, activeTopic.id).length : 0,
        wordsReviewed: activeTopic ? getWordsForTopic(currentLevel, activeTopic.id).filter(w => (repsMap.get(w.id) ?? 0) > 0).length : 0,
      });

      activeWords = unlocked.flatMap(topic => getWordsForTopic(currentLevel, topic.id));
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
    const pct = totalWords > 0 ? Math.round((reviewedWords / totalWords) * 100) : 0;
    setMasteredPct(pct);
    setKnownWords(reviewedWords);
    setLevelTotal(totalWords);

    const activeWordIds = activeWords.map(w => w.id);
    const rows = useTopics
      ? await db.getDueCardsForWordIds(activeWordIds, 10)
      : await db.getDueCardsForLevel(currentLevel, 10);
    const items = buildQueue(rows);

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
      }
    }, [])
  );

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

  const current = queue[currentIndex];

  useEffect(() => {
    if (!current || loading || done) return;
    const [, learned] = direction;
    // Easy sentence (tap-to-order): the learned-language sentence IS the answer the
    // user must assemble, so don't auto-read it aloud — that would reveal the solution.
    if (current.isEasySentence) return;
    const { frontLang } = getFrontBack(current);
    if (frontLang === learned) {
      const frontText = String(current.word[current.type === 'word' ? learned : `sentence_${learned}`]);
      Speech.speak(frontText, { language: learned });
    }
  }, [currentIndex, queue.length, loading, done]);

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

  const advance = async (rating: Grade) => {
    if (!current) return;

    const result = f.repeat(current.card, new Date());
    const updated = result[rating].card;
    const wasCorrect = rating !== Rating.Again;

    const responseTimeMs = Date.now() - cardStartTime;

    const db = getDb();
    await db.updateCard(current.wordId, current.type, updated);
    await db.recordAttempt(current.wordId, current.type, wasCorrect, responseTimeMs);
    await db.updateStreak();
    setKnownWords(await db.getReviewedWordCount(level));
    await checkLevelChange(wasCorrect);

    const streakData = await db.getStreak();
    setStreak(streakData.current_count);

    const next = currentIndex + 1;
    setReviewed(reviewed + 1);

    if (next >= queue.length) {
      const levelData = await db.getLevel();
      const currentLevel = levelData.level as Level;
      const { getWordsForLevel: gwfl } = require('@/data/words');
      const lvlWords = gwfl(currentLevel);
      const rvw = await db.getReviewedWordCount(currentLevel);
      const newPct = lvlWords.length > 0 ? Math.round((rvw / lvlWords.length) * 100) : 0;
      setMasteredPct(newPct);
      setKnownWords(rvw);
      setLevelTotal(lvlWords.length);

      const topics = getTopicsForLevel(currentLevel);
      const useTopics = topics.length > 0 && lvlWords.some((w: WordEntry) => w['topic']);

      let newRows: any[];
      if (useTopics) {
        const allWordIds = lvlWords.map((w: WordEntry) => w.id);
        const repsMap = await db.getWordReps(allWordIds);
        const { unlocked, activeTopic, completedCount } = computeUnlockedTopics(topics, repsMap, currentLevel);

        if (topicProgress && completedCount > topicProgress.done && activeTopic) {
          const s = t();
          const lang = direction[1] === 'hu' ? 'hu' : direction[1] === 'es' ? 'es' : direction[1] === 'de' ? 'de' : 'en';
          const prevCompleted = topics[completedCount - 1];
          if (prevCompleted) {
            setTopicCompleteMsg(s.topic.complete);
            setTimeout(() => setTopicCompleteMsg(null), 3000);
          }
        }

        setCurrentTopic(activeTopic);
        setTopicProgress({
          done: completedCount,
          total: topics.length,
          wordsInTopic: activeTopic ? getWordsForTopic(currentLevel, activeTopic.id).length : 0,
          wordsReviewed: activeTopic ? getWordsForTopic(currentLevel, activeTopic.id).filter(w => (repsMap.get(w.id) ?? 0) > 0).length : 0,
        });

        const activeWordIds = unlocked.flatMap(topic => getWordsForTopic(currentLevel, topic.id)).map(w => w.id);
        for (const w of unlocked.flatMap(topic => getWordsForTopic(currentLevel, topic.id))) {
          await db.ensureCard(w.id, 'word');
          await db.ensureCard(w.id, 'sentence');
        }
        newRows = await db.getDueCardsForWordIds(activeWordIds, 10);
      } else {
        newRows = await db.getDueCardsForLevel(currentLevel, 10);
      }

      const newItems = buildQueue(newRows);

      if (newItems.length === 0) {
        setDone(true);
      } else {
        setQueue(newItems);
        setCurrentIndex(0);
      }
    } else {
      setCurrentIndex(next);
    }
    setRevealed(false);
    setTypedAnswer('');
    setTypingResult(null);
    setCardStartTime(Date.now());
    setPracticeTyping(false);
    setPracticeResult(null);
    setPracticeText('');
  };

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
    const answer = typedAnswer.trim().toLowerCase().replace(/[.]+$/, '').trim();
    const correct = back.toLowerCase().split(' / ')[0].trim().replace(/[¡¿]/g, '').replace(/[.]+$/, '').trim();
    const dist = levenshtein(answer, correct);

    // Forgiving: ignore case + trailing period, accept up to 2-letter typos as fully correct.
    setTypingResult(dist <= 2 ? 'correct' : 'wrong');
    setRevealed(true);
    const { backLang } = getFrontBack(current);
    Speech.speak(back, { language: backLang });
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
    const examAvailable = getExamQuestionsFor(direction[1], level).length > 0 && masteredPct >= 70;
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
    Speech.speak(back, { language: backLang });
  };

  const topicLang = direction[1] === 'hu' ? 'hu' : direction[1] === 'es' ? 'es' : direction[1] === 'de' ? 'de' : 'en';

  const levelBadge = (
    <View style={[styles.levelBadge, { backgroundColor: '#38BDF8' }]}>
      <Text style={styles.levelText}>{level}</Text>
    </View>
  );

  const topicHeader = currentTopic && topicProgress ? (
    <View style={styles.topicHeader}>
      <Text style={[styles.topicIcon, { color: currentTopic.type === 'grammar' ? '#22C55E' : '#38BDF8' }]}>
        {currentTopic.type === 'grammar' ? '📗' : '📘'}
      </Text>
      <Text style={[styles.topicName, { color: colors.text }]} numberOfLines={1}>
        {getTopicName(currentTopic, topicLang)}
      </Text>
    </View>
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

  const topicCompleteOverlay = topicCompleteMsg ? (
    <View style={[styles.levelUpOverlay, { backgroundColor: '#22C55E' }]}>
      <Text style={styles.levelUpText}>{topicCompleteMsg}</Text>
    </View>
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
    const targetWordList = learnedSentence.replace(/[.!?¡¿,;:]/g, '').split(/\s+/).filter(Boolean);
    const levelWords = getWordsForLevel(level);
    const sentenceWordsLower = new Set(targetWordList.map(w => w.toLowerCase()));
    const traps = levelWords
      .map(w => String(w[learned]).split(' / ')[0])
      .filter(w => w && !sentenceWordsLower.has(w.toLowerCase()))
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

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
            db.buryCard(current.wordId, current.type).then(() => advance(Rating.Good));
          }}
        />
        <FeedbackButton level={level} languagePair={direction.join('→')} currentCard={`easy:${nativeSentence}`} />
      </View>
    );
  }

  if (current.isTyping) {
    const resultColor = typingResult === 'correct' ? '#22C55E' : typingResult === 'almost' ? '#EAB308' : '#EF4444';
    const resultText = typingResult === 'correct' ? s.card.correct : typingResult === 'almost' ? s.card.almostCorrect : s.card.wrong;

    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={[styles.frontRow, { marginBottom: 16 }]}>
            <Text style={[styles.frontText, { color: colors.text }]}>{front}</Text>
            <Pressable onPress={() => Speech.speak(front, { language: frontLang })} style={styles.speakBtn}>
              <Text style={styles.speakIcon}>🔊</Text>
            </Pressable>
          </View>

          <TextInput
            ref={inputRef}
            style={[styles.input, { color: colors.text, borderColor: typingResult ? resultColor : colors.tabIconDefault }]}
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

          {revealed && (
            <View style={styles.resultSection}>
              <Text style={[styles.resultText, { color: resultColor }]}>{resultText}</Text>
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
          style={styles.buryBtn}
          onPress={() => {
            const db = getDb();
            db.buryCard(current.wordId, current.type).then(() => advance(Rating.Good));
          }}
        >
          <Text style={styles.buryText}>{s.buttons.iKnowThis}</Text>
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
        <Text style={[styles.counter, { color: colors.tabIconDefault }]}>
          {currentIndex + 1}/{queue.length}
        </Text>
      </View>
      {topicHeader}
      {progressMeter}

      <Pressable
        style={[styles.card, { backgroundColor: colors.card }]}
        onPress={() => {
          if (!revealed) {
            setRevealed(true);
            const [, learned] = direction;
            if (backLang === learned) {
              Speech.speak(back, { language: backLang });
            }
          }
        }}
      >
        <View style={styles.frontRow}>
          <Text style={[styles.frontText, { color: colors.text }]}>{front}</Text>
          <Pressable onPress={() => Speech.speak(front, { language: frontLang })} style={styles.speakBtn}>
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
                    const correct = back.toLowerCase().split(' / ')[0].trim().replace(/[¡¿]/g, '').replace(/[.]+$/, '').trim();
                    const dist = levenshtein(practiceText.trim().toLowerCase().replace(/[.]+$/, '').trim(), correct);
                    setPracticeResult(dist <= 2 ? 'correct' : 'wrong');
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
          style={styles.buryBtn}
          onPress={() => {
            const db = getDb();
            db.buryCard(current.wordId, current.type).then(() => advance(Rating.Good));
          }}
        >
          <Text style={styles.buryText}>{s.buttons.iKnowThis}</Text>
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
  resultSection: {
    alignItems: 'center',
    marginTop: 12,
  },
  resultText: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
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
  topicName: {
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  topicCount: {
    fontSize: 12,
    fontWeight: '500',
  },
});
