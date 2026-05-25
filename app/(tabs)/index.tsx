import { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, Pressable, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { fsrs, Rating, type Card, type Grade } from 'ts-fsrs';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { getDb, cardFromRow } from '@/lib/database';
import { words, type WordEntry, getWordsForLevel, LEVELS, type Level } from '@/data/words';
import { t } from '@/lib/i18n';
import { levenshtein } from '@/lib/levenshtein';
import FeedbackButton from '@/components/FeedbackModal';
import * as Speech from 'expo-speech';
import ExamCard from '@/components/ExamCard';
import { getExamQuestionsForLevel, type ExamQuestion } from '@/data/exams';

const f = fsrs();

interface DueItem {
  wordId: number;
  type: string;
  card: Card;
  word: WordEntry;
  isTyping: boolean;
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
  const [examQuestions, setExamQuestions] = useState<ExamQuestion[]>([]);
  const [examIndex, setExamIndex] = useState(0);
  const [examCorrect, setExamCorrect] = useState(0);
  const [examDone, setExamDone] = useState(false);
  const [masteredPct, setMasteredPct] = useState(0);
  const inputRef = useRef<TextInput>(null);

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
    for (const w of levelWords) {
      await db.ensureCard(w.id, 'word');
      await db.ensureCard(w.id, 'sentence');
    }

    const rows = await db.getDueCardsForLevel(currentLevel, 10);
    const items: DueItem[] = rows.map((row: any) => ({
      wordId: row.word_id,
      type: row.type,
      card: cardFromRow(row),
      word: words.find(w => w.id === row.word_id)!,
      isTyping: Math.random() < 0.5,
    })).filter((item: DueItem) => item.word);

    const streakData = await db.getStreak();
    setStreak(streakData.current_count);
    setQueue(items);
    setCurrentIndex(0);
    setRevealed(false);
    setReviewed(0);
    setTypedAnswer('');
    setTypingResult(null);
    setDone(items.length === 0);

    const totalWords = levelWords.length;
    const reviewedWords = await db.getReviewedWordCount(currentLevel);
    setMasteredPct(totalWords > 0 ? Math.round((reviewedWords / totalWords) * 100) : 0);

    setCardStartTime(Date.now());
    setPracticeTyping(false);
    setPracticeResult(null);
    setPracticeText('');
    setLoading(false);
  };

  useEffect(() => {
    loadCards();
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      if (done || loading) return;
      if (!current) return;
      if (current.isTyping && current.type === 'word') return;
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

  const getFrontBack = (item: DueItem) => {
    const [source, target] = direction;
    const isWord = item.type === 'word';
    return {
      front: String(isWord ? item.word[source] : item.word[`sentence_${source}`]),
      back: String(isWord ? item.word[target] : item.word[`sentence_${target}`]),
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

      if (correct_streak >= 5 && mistakes_in_window <= 1) {
        if (levelIdx < LEVELS.length - 1) {
          const newLevel = LEVELS[levelIdx + 1];
          await db.updateLevel(newLevel, 0, 0, 0);
          setLevel(newLevel);
          setLevelUpMsg(`↑ ${newLevel}`);
          setTimeout(() => setLevelUpMsg(null), 2000);

          const newLevelWords = getWordsForLevel(newLevel);
          for (const w of newLevelWords) {
            await db.ensureCard(w.id, 'word');
            await db.ensureCard(w.id, 'sentence');
          }
          return;
        }
      }
      await db.updateLevel(currentLevel, correct_streak, mistakes_in_window, fail_streak);
    } else {
      fail_streak += 1;
      mistakes_in_window += 1;
      correct_streak = 0;

      if (mistakes_in_window >= 2) {
        correct_streak = 0;
        mistakes_in_window = 0;
      }

      if (fail_streak >= 5 && levelIdx > 0) {
        const newLevel = LEVELS[levelIdx - 1];
        await db.updateLevel(newLevel, 0, 0, 0);
        setLevel(newLevel);
        setLevelUpMsg(`↓ ${newLevel}`);
        setTimeout(() => setLevelUpMsg(null), 2000);
        return;
      }
      await db.updateLevel(currentLevel, correct_streak, mistakes_in_window, fail_streak);
    }
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
    await checkLevelChange(wasCorrect);

    const streakData = await db.getStreak();
    setStreak(streakData.current_count);

    const next = currentIndex + 1;
    setReviewed(reviewed + 1);

    if (next >= queue.length) {
      const levelData = await db.getLevel();
      const newRows = await db.getDueCardsForLevel(levelData.level, 10);
      const newItems: DueItem[] = newRows.map((row: any) => ({
        wordId: row.word_id,
        type: row.type,
        card: cardFromRow(row),
        word: words.find(w => w.id === row.word_id)!,
        isTyping: Math.random() < 0.5,
      })).filter((item: DueItem) => item.word);

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
    const answer = typedAnswer.trim().toLowerCase();
    const correct = back.toLowerCase().split(' / ')[0].trim().replace(/[¡¿]/g, '');
    const dist = levenshtein(answer, correct);

    if (dist === 0) {
      setTypingResult('correct');
    } else if (dist <= 2) {
      setTypingResult('almost');
    } else {
      setTypingResult('wrong');
    }
    setRevealed(true);
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

  if (examMode && !examDone) {
    const eq = examQuestions[examIndex];
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <View style={[styles.levelBadge, { backgroundColor: colors.accent }]}>
            <Text style={styles.levelText}>{s.exam.tag}</Text>
          </View>
          <Text style={[styles.counter, { color: colors.tabIconDefault }]}>
            {examIndex + 1}/5
          </Text>
        </View>
        {eq && <ExamCard question={eq} onResult={async (correct) => {
          const newCorrect = examCorrect + (correct ? 1 : 0);
          setExamCorrect(newCorrect);
          if (examIndex + 1 >= 5) {
            setExamDone(true);
            if (newCorrect >= 4) {
              const levelIdx = LEVELS.indexOf(level);
              if (levelIdx < LEVELS.length - 1) {
                const newLevel = LEVELS[levelIdx + 1];
                const db = getDb();
                await db.updateLevel(newLevel, 0, 0, 0);
                setLevel(newLevel);
              }
            }
          } else {
            setExamIndex(examIndex + 1);
          }
        }} />}
        <FeedbackButton level={level} languagePair={direction.join('→')} currentCard={`exam:${examIndex + 1}`} />
      </View>
    );
  }

  if (examMode && examDone) {
    const passed = examCorrect >= 4;
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={styles.doneEmoji}>{passed ? '🏆' : '📚'}</Text>
        <Text style={[styles.doneTitle, { color: colors.text }]}>
          {passed ? `${level} ↑` : 'Még nem, de közel vagy!'}
        </Text>
        <Text style={[styles.doneSubtitle, { color: colors.tabIconDefault }]}>
          {examCorrect}/5
        </Text>
        <Pressable
          style={[styles.examStartBtn, { backgroundColor: colors.tint }]}
          onPress={() => { setExamMode(false); setExamDone(false); setExamIndex(0); setExamCorrect(0); loadCards(); }}
        >
          <Text style={styles.examStartBtnText}>→</Text>
        </Pressable>
      </View>
    );
  }

  const startExam = () => {
    const questions = getExamQuestionsForLevel(level);
    const shuffled = questions.sort(() => Math.random() - 0.5).slice(0, 5);
    setExamQuestions(shuffled);
    setExamIndex(0);
    setExamCorrect(0);
    setExamDone(false);
    setExamMode(true);
  };

  if (done) {
    const hasExamQuestions = getExamQuestionsForLevel(level).length > 0 && masteredPct >= 80;
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={styles.doneEmoji}>🎉</Text>
        <Text style={[styles.doneTitle, { color: colors.text }]}>{s.done.title}</Text>
        <Text style={[styles.doneSubtitle, { color: colors.tabIconDefault }]}>
          {s.done.reviewed(reviewed)}
        </Text>
        <View style={[styles.levelBadgeLarge, { backgroundColor: '#38BDF8' }]}>
          <Text style={styles.levelTextLarge}>{level}</Text>
        </View>
        <View style={[styles.streakBadge, { backgroundColor: colors.card, marginTop: 12 }]}>
          <Text style={[styles.streakNumber, { color: colors.accent }]}>{streak}</Text>
          <Text style={[styles.streakLabel, { color: colors.tabIconDefault }]}>{s.done.streak}</Text>
        </View>
        <Text style={[styles.masteredText, { color: masteredPct >= 80 ? '#22C55E' : colors.tabIconDefault }]}>
          {level}: {masteredPct}% {masteredPct < 80 ? '(vizsga: 80%)' : '✓'}
        </Text>
        {hasExamQuestions && (
          <Pressable style={[styles.examStartBtn, { backgroundColor: colors.accent, marginTop: 20 }]} onPress={startExam}>
            <Text style={styles.examStartBtnText}>🎓 Vizsga</Text>
          </Pressable>
        )}
        <FeedbackButton level={level} languagePair={direction.join('→')} currentCard="done" />
      </View>
    );
  }

  const { front, back } = getFrontBack(current);
  const isWord = current.type === 'word';
  const typeLabel = isWord ? s.card.word : s.card.sentence;
  const sourceLang = direction[0];

  const speakFront = () => {
    Speech.speak(front, { language: sourceLang });
  };

  const levelBadge = (
    <View style={[styles.levelBadge, { backgroundColor: '#38BDF8' }]}>
      <Text style={styles.levelText}>{level}</Text>
    </View>
  );

  const levelUpOverlay = levelUpMsg ? (
    <View style={[styles.levelUpOverlay, { backgroundColor: levelUpMsg.startsWith('↑') ? '#2563EB' : '#EF4444' }]}>
      <Text style={styles.levelUpText}>{levelUpMsg}</Text>
    </View>
  ) : null;

  if (current.isTyping && isWord) {
    const resultColor = typingResult === 'correct' ? '#22C55E' : typingResult === 'almost' ? '#EAB308' : '#EF4444';
    const resultText = typingResult === 'correct' ? s.card.correct : typingResult === 'almost' ? s.card.almostCorrect : s.card.wrong;

    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {levelUpOverlay}
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

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.typeTag, { color: colors.tint }]}>{typeLabel}</Text>
          <View style={styles.frontRow}>
            <Text style={[styles.frontText, { color: colors.text }]}>{front}</Text>
            <Pressable onPress={speakFront} style={styles.speakBtn}>
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
              <Text style={[styles.correctAnswer, { color: colors.tint }]}>{back}</Text>
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

        <FeedbackButton level={level} languagePair={direction.join('→')} currentCard={`${current.type}:${front}`} />
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {levelUpOverlay}
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

      <Pressable
        style={[styles.card, { backgroundColor: colors.card }]}
        onPress={() => !revealed && setRevealed(true)}
      >
        <Text style={[styles.typeTag, { color: colors.tint }]}>{typeLabel}</Text>
        <View style={styles.frontRow}>
          <Text style={[styles.frontText, { color: colors.text }]}>{front}</Text>
          <Pressable onPress={speakFront} style={styles.speakBtn}>
            <Text style={styles.speakIcon}>🔊</Text>
          </Pressable>
        </View>

        {revealed ? (
          <View style={styles.backSection}>
            <View style={[styles.divider, { backgroundColor: '#38BDF8' }]} />
            <Text style={[styles.backText, { color: colors.tint }]}>{back}</Text>
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
                    const correct = back.toLowerCase().split(' / ')[0].trim().replace(/[¡¿]/g, '');
                    const dist = levenshtein(practiceText.trim().toLowerCase(), correct);
                    setPracticeResult(dist === 0 ? 'correct' : dist <= 2 ? 'almost' : 'wrong');
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
  levelBadgeLarge: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 12,
  },
  levelTextLarge: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },
  levelUpOverlay: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  levelUpText: {
    fontSize: 22,
    fontWeight: '800',
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
  typeTag: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
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
  masteredText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
  },
  examStartBtn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    minWidth: 160,
    alignItems: 'center',
  },
  examStartBtnText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
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
  doneEmoji: {
    fontSize: 64,
    textAlign: 'center',
    marginBottom: 16,
  },
  doneTitle: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  doneSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
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
});
