import { useEffect, useState, useCallback } from 'react';
import { StyleSheet, Text, View, Pressable, ActivityIndicator } from 'react-native';
import { fsrs, Rating, type Card, type Grade } from 'ts-fsrs';
import { useFocusEffect } from 'expo-router';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { getDb, cardFromRow } from '@/lib/database';
import { words, type WordEntry } from '@/data/words';

const f = fsrs();

interface DueItem {
  wordId: number;
  type: string;
  card: Card;
  word: WordEntry;
}

export default function PassiveScreen() {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];

  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<DueItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [streak, setStreak] = useState(0);
  const [reviewed, setReviewed] = useState(0);
  const [done, setDone] = useState(false);

  const loadCards = useCallback(async () => {
    const db = getDb();

    for (const w of words) {
      await db.ensureCard(w.id, 'word');
      await db.ensureCard(w.id, 'sentence');
    }

    const rows = await db.getDueCards(30);
    const items: DueItem[] = rows.map((row: any) => ({
      wordId: row.word_id,
      type: row.type,
      card: cardFromRow(row),
      word: words.find(w => w.id === row.word_id)!,
    })).filter((item: DueItem) => item.word);

    const streakData = await db.getStreak();
    setStreak(streakData.current_count);
    setQueue(items);
    setCurrentIndex(0);
    setRevealed(false);
    setReviewed(0);
    setDone(items.length === 0);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCards();
    }, [loadCards])
  );

  const current = queue[currentIndex];

  const handleRate = async (rating: Grade) => {
    if (!current) return;

    const result = f.repeat(current.card, new Date());
    const updated = result[rating].card;

    const db = getDb();
    await db.updateCard(current.wordId, current.type, updated);
    await db.updateStreak();

    const streakData = await db.getStreak();
    setStreak(streakData.current_count);

    const next = currentIndex + 1;
    const newReviewed = reviewed + 1;
    setReviewed(newReviewed);

    if (next >= queue.length) {
      const newRows = await db.getDueCards(30);
      const newItems: DueItem[] = newRows.map((row: any) => ({
        wordId: row.word_id,
        type: row.type,
        card: cardFromRow(row),
        word: words.find(w => w.id === row.word_id)!,
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
        <Text style={[styles.doneEmoji]}>🎉</Text>
        <Text style={[styles.doneTitle, { color: colors.text }]}>Kész vagy mára!</Text>
        <Text style={[styles.doneSubtitle, { color: colors.tabIconDefault }]}>
          {reviewed} kártyát néztél át.
        </Text>
        <View style={[styles.streakBadge, { backgroundColor: colors.card }]}>
          <Text style={[styles.streakNumber, { color: colors.accent }]}>{streak}</Text>
          <Text style={[styles.streakLabel, { color: colors.tabIconDefault }]}>nap streak</Text>
        </View>
      </View>
    );
  }

  const isWord = current.type === 'word';
  const front = isWord ? current.word.es : current.word.sentence_es;
  const back = isWord ? current.word.hu : current.word.sentence_hu;
  const typeLabel = isWord ? 'szó' : 'mondat';

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
            Koppints a fordításhoz
          </Text>
        )}
      </Pressable>

      {revealed && (
        <View style={styles.buttons}>
          <Pressable
            style={[styles.button, { backgroundColor: '#EF4444' }]}
            onPress={() => handleRate(Rating.Again)}
          >
            <Text style={styles.buttonText}>újra</Text>
          </Pressable>
          <Pressable
            style={[styles.button, { backgroundColor: colors.tint }]}
            onPress={() => handleRate(Rating.Good)}
          >
            <Text style={styles.buttonText}>Jó</Text>
          </Pressable>
          <Pressable
            style={[styles.button, { backgroundColor: colors.accent }]}
            onPress={() => handleRate(Rating.Easy)}
          >
            <Text style={styles.buttonText}>unom</Text>
          </Pressable>
        </View>
      )}
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
});
