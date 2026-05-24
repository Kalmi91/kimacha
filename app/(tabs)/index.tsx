import { useEffect, useState, useCallback, useRef } from 'react';
import { StyleSheet, Text, View, Pressable, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { fsrs, Rating, type Card, type Grade } from 'ts-fsrs';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { getDb, cardFromRow } from '@/lib/database';
import { words, type WordEntry } from '@/data/words';
import { t } from '@/lib/i18n';
import { levenshtein } from '@/lib/levenshtein';

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
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
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
  const inputRef = useRef<TextInput>(null);

  const loadCards = useCallback(async () => {
    const db = getDb();
    const onboarding = await db.getOnboarding();
    if (onboarding) {
      setDirection([onboarding.source, onboarding.target]);
    }

    for (const w of words) {
      await db.ensureCard(w.id, 'word');
      await db.ensureCard(w.id, 'sentence');
    }

    const rows = await db.getDueCards(10);
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
    setLoading(false);
  }, []);

  useEffect(() => {
    loadCards();
  }, []);

  const current = queue[currentIndex];

  const getFrontBack = (item: DueItem) => {
    const [source, target] = direction;
    const isWord = item.type === 'word';
    if (source === 'es') {
      return {
        front: isWord ? item.word.es : item.word.sentence_es,
        back: isWord ? item.word.hu : item.word.sentence_hu,
      };
    }
    return {
      front: isWord ? item.word.hu : item.word.sentence_hu,
      back: isWord ? item.word.es : item.word.sentence_es,
    };
  };

  const advance = async (rating: Grade) => {
    if (!current) return;

    const result = f.repeat(current.card, new Date());
    const updated = result[rating].card;

    const db = getDb();
    await db.updateCard(current.wordId, current.type, updated);
    await db.updateStreak();

    const streakData = await db.getStreak();
    setStreak(streakData.current_count);

    const next = currentIndex + 1;
    setReviewed(reviewed + 1);

    if (next >= queue.length) {
      const newRows = await db.getDueCards(10);
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
  };

  const handleInSentence = async () => {
    if (!current) return;

    const result = f.repeat(current.card, new Date());
    const updated = result[Rating.Again].card;

    const db = getDb();
    await db.updateCard(current.wordId, current.type, updated);
    await db.updateStreak();

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

    const newQueue = [...queue];
    newQueue.splice(currentIndex + 1, 0, sentenceCard);
    setQueue(newQueue);
    setCurrentIndex(currentIndex + 1);
    setRevealed(false);
    setTypedAnswer('');
    setTypingResult(null);
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

  if (done) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={styles.doneEmoji}>🎉</Text>
        <Text style={[styles.doneTitle, { color: colors.text }]}>{s.done.title}</Text>
        <Text style={[styles.doneSubtitle, { color: colors.tabIconDefault }]}>
          {s.done.reviewed(reviewed)}
        </Text>
        <View style={[styles.streakBadge, { backgroundColor: colors.card }]}>
          <Text style={[styles.streakNumber, { color: colors.accent }]}>{streak}</Text>
          <Text style={[styles.streakLabel, { color: colors.tabIconDefault }]}>{s.done.streak}</Text>
        </View>
      </View>
    );
  }

  const { front, back } = getFrontBack(current);
  const isWord = current.type === 'word';
  const typeLabel = isWord ? s.card.word : s.card.sentence;

  if (current.isTyping && isWord) {
    const resultColor = typingResult === 'correct' ? '#22C55E' : typingResult === 'almost' ? '#EAB308' : '#EF4444';
    const resultText = typingResult === 'correct' ? s.card.correct : typingResult === 'almost' ? s.card.almostCorrect : s.card.wrong;

    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
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
          <Text style={[styles.frontText, { color: colors.text }]}>{front}</Text>

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
              style={[styles.button, styles.checkButton, { backgroundColor: colors.tint }]}
              onPress={handleCheck}
            >
              <Text style={styles.buttonText}>{s.card.check}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.buttons}>
            <Pressable
              style={[styles.button, styles.checkButton, { backgroundColor: typingResult === 'wrong' ? '#EF4444' : colors.tint }]}
              onPress={handleTypingNext}
            >
              <Text style={styles.buttonText}>→</Text>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
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
        <Text style={[styles.frontText, { color: colors.text }]}>{front}</Text>

        {revealed ? (
          <View style={styles.backSection}>
            <View style={[styles.divider, { backgroundColor: colors.tint }]} />
            <Text style={[styles.backText, { color: colors.tint }]}>{back}</Text>
          </View>
        ) : (
          <Text style={[styles.tapHint, { color: colors.tabIconDefault }]}>
            {s.card.tapToReveal}
          </Text>
        )}
      </Pressable>

      <View style={[styles.buttons, { opacity: revealed ? 1 : 0 }]} pointerEvents={revealed ? 'auto' : 'none'}>
        <Pressable
          style={[styles.button, { backgroundColor: '#EF4444' }]}
          onPress={() => advance(Rating.Again)}
        >
          <Text style={styles.buttonText}>{s.buttons.again}</Text>
        </Pressable>
        <Pressable
          style={[styles.button, { backgroundColor: colors.tint }]}
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
    marginBottom: 16,
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
