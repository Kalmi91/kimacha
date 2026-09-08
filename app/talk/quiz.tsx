import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { getDb } from '@/lib/database';
import type { Level } from '@/data/words';
import { getMacro, macroName } from '@/lib/talk/catalog';
import { buildTalkQuiz } from '@/lib/talk/quiz';

// Az Átbeszélő harmadik formátuma: a cella szavai, négy válasszal. A kérdések
// futásidőben épülnek (lib/talk/quiz.ts), ezért ez a formátum minden olyan
// makró×szint cellában megy, aminek a fában van szava, megírt pakk nélkül is.
const QUESTION_COUNT = 10;

export default function TalkQuizScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();
  const router = useRouter();
  const { macro: macroParam, level: levelParam } = useLocalSearchParams<{ macro: string; level: string }>();
  const macro = Number(macroParam);
  const level = (levelParam ?? 'A1') as Level;

  const [contentLang, setContentLang] = useState('es');
  const [nativeLang, setNativeLang] = useState('hu');
  const [round, setRound] = useState(0);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [done, setDone] = useState(false);

  const load = useCallback(async () => {
    const db = getDb();
    const onboarding = await db.getOnboarding();
    const source = onboarding?.source ?? 'hu';
    setContentLang(onboarding?.target ?? 'es');
    setNativeLang(source === 'hu' ? 'hu' : source === 'es' ? 'es' : source === 'de' ? 'de' : 'en');
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // A `round` a seed része, így az „Újra" tényleg más kérdéssort ad.
  const items = useMemo(
    () => buildTalkQuiz(macro, level, contentLang, nativeLang, macro * 1000 + round, QUESTION_COUNT),
    [macro, level, contentLang, nativeLang, round]
  );

  const def = getMacro(macro);
  const item = items[index];

  const pick = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    if (item && i === item.correctIndex) setCorrect((c) => c + 1);
  };

  const next = () => {
    if (index + 1 >= items.length) {
      setDone(true);
      return;
    }
    setIndex(index + 1);
    setPicked(null);
  };

  const again = () => {
    setRound((r) => r + 1);
    setIndex(0);
    setPicked(null);
    setCorrect(0);
    setDone(false);
  };

  const header = (
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} hitSlop={12}>
        <Text style={[styles.back, { color: colors.text }]}>←</Text>
      </Pressable>
      <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
        {def ? macroName(def, nativeLang) : s.talk.formatQuiz} · {level}
      </Text>
      <Text style={[styles.counter, { color: colors.tabIconDefault }]}>
        {items.length > 0 && !done ? `${index + 1}/${items.length}` : ''}
      </Text>
    </View>
  );

  if (items.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {header}
        <Text style={[styles.empty, { color: colors.tabIconDefault }]}>{s.talk.quizEmpty}</Text>
      </View>
    );
  }

  if (done) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {header}
        <View style={styles.doneBody}>
          <Text style={[styles.result, { color: colors.text }]}>{s.talk.quizResult(correct, items.length)}</Text>
          <Pressable style={[styles.primaryBtn, { backgroundColor: colors.tint }]} onPress={again}>
            <Text style={[styles.primaryBtnText, { color: colors.background }]}>{s.talk.quizAgain}</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={() => router.back()}>
            <Text style={[styles.secondaryBtnText, { color: colors.tint }]}>{s.talk.quizBack}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {header}
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.prompt, { color: colors.tabIconDefault }]}>{s.talk.quizPrompt}</Text>
        <Text style={[styles.word, { color: colors.text }]}>{item.prompt}</Text>

        {item.options.map((opt, i) => {
          const isCorrect = i === item.correctIndex;
          const revealed = picked !== null;
          const bg = revealed && isCorrect
            ? '#2e7d32'
            : revealed && i === picked
              ? '#c62828'
              : colors.card;
          const fg = revealed && (isCorrect || i === picked) ? '#ffffff' : colors.text;
          return (
            <Pressable
              key={`${i}-${opt}`}
              style={[styles.option, { backgroundColor: bg }]}
              onPress={() => pick(i)}>
              <Text style={[styles.optionText, { color: fg }]}>{opt}</Text>
            </Pressable>
          );
        })}

        {picked !== null && (
          <Pressable style={[styles.primaryBtn, { backgroundColor: colors.tint }]} onPress={next}>
            <Text style={[styles.primaryBtnText, { color: colors.background }]}>
              {index + 1 >= items.length ? s.talk.quizFinish : s.talk.quizNext}
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 8,
    gap: 12,
  },
  back: { fontSize: 26 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700' },
  counter: { fontSize: 13 },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  prompt: { fontSize: 13, marginTop: 20 },
  word: { fontSize: 30, fontWeight: '700', marginTop: 6, marginBottom: 26 },
  option: { borderRadius: 12, paddingVertical: 15, paddingHorizontal: 16, marginBottom: 10 },
  optionText: { fontSize: 17 },
  primaryBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  primaryBtnText: { fontSize: 16, fontWeight: '700' },
  secondaryBtn: { paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  secondaryBtnText: { fontSize: 15, fontWeight: '600' },
  doneBody: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  result: { fontSize: 26, fontWeight: '700', textAlign: 'center', marginBottom: 26 },
  empty: { fontSize: 14, textAlign: 'center', marginTop: 40 },
});
