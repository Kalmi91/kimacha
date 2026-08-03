import { useState, useCallback } from 'react';
import { StyleSheet, Text, View, Pressable, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Speech from 'expo-speech';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { getDb } from '@/lib/database';
import { words } from '@/data/words';
import { t } from '@/lib/i18n';
import { charDiff } from '@/lib/charDiff';
import { speechLang } from '@/lib/languages';
import { spellingLadderDays } from '@/lib/spellingLadder';
import FeedbackButton from '@/components/FeedbackModal';

// FB25/FB84: shared char diff, called with fold=false, spelling practice is
// graded byte-for-byte, so case and accent differences must stay visible.
const spellingDiff = (typed: string, correct: string) => charDiff(typed, correct, false);

interface QueueItem {
  wordId: number;
  step: number;
}

export default function SpellingScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [direction, setDirection] = useState<[string, string]>(['es', 'hu']);
  const [level, setLevel] = useState('A0');
  const [totalInList, setTotalInList] = useState(0);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);

  const loadQueue = useCallback(async () => {
    const db = getDb();
    const onboarding = await db.getOnboarding();
    const native = onboarding?.source ?? 'es';
    const learned = onboarding?.target ?? 'hu';
    setDirection([native, learned]);
    const levelData = await db.getLevel();
    setLevel(levelData.level);

    const list = await db.getSpellingList();
    setTotalInList(list.length);
    const now = new Date().toISOString();
    const due = list.filter((row) => row.due <= now).sort((a, b) => a.due.localeCompare(b.due));

    setQueue(due.map((row) => ({ wordId: row.wordId, step: row.step })));
    setCurrentIndex(0);
    setTypedAnswer('');
    setResult(null);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadQueue();
    }, [loadQueue])
  );

  const current = queue[currentIndex];
  const currentWord = current ? words.find((w) => w.id === current.wordId) : undefined;

  const [native, learned] = direction;
  const prompt = currentWord ? String(currentWord[native]) : '';
  const target = currentWord ? String(currentWord[learned]).split(' / ')[0] : '';

  const handleCheck = async () => {
    if (!current || !currentWord) return;
    const ok = typedAnswer.trim().toLowerCase() === target.toLowerCase();
    setResult(ok ? 'correct' : 'wrong');

    const db = getDb();
    if (ok) {
      const nextStep = current.step + 1;
      const due = new Date(Date.now() + spellingLadderDays(current.step) * 86400000).toISOString();
      await db.updateSpellingStep(current.wordId, nextStep, due);
    } else {
      await db.updateSpellingStep(current.wordId, 0, new Date().toISOString());
    }
  };

  const handleNext = () => {
    if (!current) return;
    const rest = queue.filter((_, i) => i !== currentIndex);
    // Wrong answers go to the back of THIS session's queue for a retry;
    // correct answers are simply removed from the session (next due date is
    // far in the future).
    const newQueue = result === 'wrong' ? [...rest, current] : rest;
    setQueue(newQueue);
    setCurrentIndex(0);
    setTypedAnswer('');
    setResult(null);
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  if (!current || !currentWord) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text }]}>{s.spelling.title}</Text>
        <Text style={[styles.emptyText, { color: colors.tabIconDefault }]}>{s.spelling.empty}</Text>
        <Text style={[styles.emptySub, { color: colors.tabIconDefault }]}>{s.spelling.totalInList(totalInList)}</Text>
        <Pressable style={[styles.backBtn, { backgroundColor: colors.tint }]} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>← {s.tabs.settings}</Text>
        </Pressable>
        <FeedbackButton level={level} languagePair={direction.join('→')} currentCard="spelling-screen" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={[styles.title, { color: colors.text }]}>{s.spelling.title}</Text>

      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={styles.frontRow}>
          <Text style={[styles.frontText, { color: colors.text }]}>{prompt}</Text>
          <Pressable onPress={() => Speech.speak(prompt, { language: speechLang(native) })} style={styles.speakBtn}>
            <Text style={styles.speakIcon}>🔊</Text>
          </Pressable>
        </View>

        <TextInput
          style={[styles.input, { color: colors.text, borderColor: result === 'correct' ? '#22C55E' : result === 'wrong' ? '#EF4444' : colors.tabIconDefault }]}
          value={typedAnswer}
          onChangeText={setTypedAnswer}
          onSubmitEditing={result ? handleNext : handleCheck}
          editable={!result}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
        />

        {result && (
          <View style={styles.resultSection}>
            <Text style={[styles.resultText, { color: result === 'correct' ? '#22C55E' : '#EF4444' }]}>
              {result === 'correct' ? s.card.correct : s.card.wrong}
            </Text>
            {result === 'wrong' && (
              <>
                <Text style={styles.diffLine}>
                  {spellingDiff(typedAnswer, target).map((d, i) => (
                    <Text
                      key={i}
                      style={d.missing ? styles.diffMissing : d.wrong ? styles.diffWrong : { color: colors.text }}
                    >
                      {d.ch}
                    </Text>
                  ))}
                </Text>
                <View style={styles.frontRow}>
                  <Text style={[styles.correctAnswer, { color: colors.tint }]}>{target}</Text>
                  <Pressable onPress={() => Speech.speak(target, { language: speechLang(learned) })} style={styles.speakBtn}>
                    <Text style={styles.speakIcon}>🔊</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        )}
      </View>

      <Pressable
        style={[styles.checkBtn, { backgroundColor: result === 'wrong' ? '#1D4ED8' : '#38BDF8' }]}
        onPress={result ? handleNext : handleCheck}
      >
        <Text style={styles.checkBtnText}>{result ? '→' : s.card.check}</Text>
      </Pressable>

      <FeedbackButton level={level} languagePair={direction.join('→')} currentCard="spelling-screen" />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 20,
  },
  card: {
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    minHeight: 220,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  frontRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  frontText: {
    fontSize: 30,
    fontWeight: '700',
    textAlign: 'center',
  },
  speakBtn: {
    padding: 4,
  },
  speakIcon: {
    fontSize: 22,
  },
  input: {
    width: '100%',
    borderWidth: 2,
    borderRadius: 12,
    padding: 14,
    fontSize: 18,
    textAlign: 'center',
  },
  resultSection: {
    alignItems: 'center',
    marginTop: 16,
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
  // FB84: amber + underline marks a letter left out, apart from the red typos.
  diffMissing: {
    backgroundColor: '#EAB308',
    color: '#FFFFFF',
    textDecorationLine: 'underline',
  },
  correctAnswer: {
    fontSize: 22,
    fontWeight: '600',
  },
  checkBtn: {
    marginTop: 24,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  checkBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  backBtn: {
    marginTop: 24,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
});
