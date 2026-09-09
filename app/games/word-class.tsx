import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { getDb } from '@/lib/database';
import { findWordById, type WordEntry } from '@/data/words';
import { getGameDef, gameName } from '@/lib/games/registry';
import { getLearnedPool } from '@/lib/games/vocabPool';
import { getGameBest, recordGameResult } from '@/lib/games/scoring';
import { useLoadOnMount } from '@/lib/useLoadOnMount';
import {
  CLASS_OPTIONS,
  buildWordClassRound,
  canPlayWordClass,
  type WordClass,
  type WordClassItem,
} from '@/lib/games/wordClass';

// FB189: „a szófajok megkülönböztetése […] erre is helyezz hansúlyt." A játék a
// MÁR TANULT szavakból kérdez (getLearnedPool), tehát nem új szót tanít, hanem
// arra kényszerít, hogy a meglévőket be tudd sorolni. A kör négy szófajt vált
// körbe, hogy ne lehessen „mindenre főnév"-vel átmenni.

const ROUND_LENGTH = 10;

export default function WordClassScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();
  const router = useRouter();
  const gameDef = getGameDef('word-class')!;

  const [contentLang, setContentLang] = useState('hu');
  const [words, setWords] = useState<WordEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [best, setBest] = useState(0);

  const [runSeed, setRunSeed] = useState(() => Math.floor(Math.random() * 100000));
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<WordClass | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [done, setDone] = useState(false);
  const [isNewBest, setIsNewBest] = useState(false);

  const load = useCallback(async () => {
    const db = getDb();
    const onboarding = await db.getOnboarding();
    const source = onboarding?.source ?? 'hu';
    const target = onboarding?.target ?? 'es';
    setContentLang(source === 'hu' || source === 'es' || source === 'de' ? source : 'en');

    const levelData = await db.getLevel();
    const pair = `${source}-${target}`;
    const pool = await getLearnedPool({
      pair,
      learnedLang: target,
      level: levelData.level as WordEntry['level'],
      minSize: 40,
    });
    // A pool csak azonosítót és szöveget hoz, a szófaj a szótári bejegyzésen van.
    setWords(pool.map((p) => findWordById(p.wordId, target)).filter((w): w is WordEntry => !!w));

    const bestRow = await getGameBest('word-class');
    setBest(bestRow?.bestScore ?? 0);
    setLoaded(true);
  }, []);

  useLoadOnMount(load);

  const nativeLang = contentLang;
  const items: WordClassItem[] = buildWordClassRound(words, 'es', nativeLang, runSeed, ROUND_LENGTH);
  const item = items[index];

  const pick = (cls: WordClass) => {
    if (picked || !item) return;
    setPicked(cls);
    if (cls === item.answer) setCorrectCount((c) => c + 1);
  };

  const next = async () => {
    if (index + 1 >= items.length) {
      const outcome = await recordGameResult('word-class', correctCount);
      setIsNewBest(outcome.isNewBest);
      setBest(outcome.best);
      setDone(true);
      return;
    }
    setIndex(index + 1);
    setPicked(null);
  };

  const again = () => {
    setRunSeed(Math.floor(Math.random() * 100000));
    setIndex(0);
    setPicked(null);
    setCorrectCount(0);
    setIsNewBest(false);
    setDone(false);
  };

  const header = (
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} hitSlop={12}>
        <Text style={[styles.back, { color: colors.text }]}>←</Text>
      </Pressable>
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
        {gameName(gameDef, contentLang)}
      </Text>
      <Text style={[styles.counter, { color: colors.tabIconDefault }]}>
        {done || items.length === 0 ? '' : `${index + 1}/${items.length}`}
      </Text>
    </View>
  );

  if (loaded && !canPlayWordClass(words)) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {header}
        <Text style={[styles.empty, { color: colors.tabIconDefault }]}>{s.games.wordClass.empty}</Text>
      </View>
    );
  }

  if (done) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {header}
        <View style={styles.doneBody}>
          <Text style={[styles.result, { color: colors.text }]}>
            {s.games.wordClass.result(correctCount, items.length || ROUND_LENGTH)}
          </Text>
          {isNewBest && <Text style={[styles.newBest, { color: colors.tint }]}>{s.games.newBest}</Text>}
          <Text style={[styles.bestLine, { color: colors.tabIconDefault }]}>{`${s.games.best}: ${best}`}</Text>
          <Pressable style={[styles.primaryBtn, { backgroundColor: colors.tint }]} onPress={again}>
            <Text style={[styles.primaryBtnText, { color: colors.background }]}>{s.games.playAgain}</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={() => router.back()}>
            <Text style={[styles.secondaryBtnText, { color: colors.tint }]}>{s.games.backToHub}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {header}
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.prompt, { color: colors.tabIconDefault }]}>{s.games.wordClass.prompt}</Text>
        <Text style={[styles.word, { color: colors.text }]}>{item?.prompt ?? ''}</Text>
        {picked && <Text style={[styles.gloss, { color: colors.tabIconDefault }]}>{item?.gloss}</Text>}

        {CLASS_OPTIONS.map((cls) => {
          const isAnswer = item && cls === item.answer;
          const bg = picked
            ? isAnswer
              ? '#2e7d32'
              : cls === picked
                ? '#c62828'
                : colors.card
            : colors.card;
          const fg = picked && (isAnswer || cls === picked) ? '#ffffff' : colors.text;
          return (
            <Pressable key={cls} style={[styles.option, { backgroundColor: bg }]} onPress={() => pick(cls)}>
              <Text style={[styles.optionText, { color: fg }]}>{s.games.wordClass.names[cls]}</Text>
            </Pressable>
          );
        })}

        {picked && (
          <Pressable style={[styles.primaryBtn, { backgroundColor: colors.tint }]} onPress={next}>
            <Text style={[styles.primaryBtnText, { color: colors.background }]}>
              {index + 1 >= items.length ? s.games.wordClass.finish : s.games.wordClass.next}
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
  title: { flex: 1, fontSize: 18, fontWeight: '700' },
  counter: { fontSize: 13 },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  prompt: { fontSize: 13, marginTop: 20 },
  word: { fontSize: 30, fontWeight: '700', marginTop: 6 },
  gloss: { fontSize: 15, marginTop: 6 },
  option: { borderRadius: 12, paddingVertical: 15, paddingHorizontal: 16, marginTop: 10 },
  optionText: { fontSize: 17 },
  primaryBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  primaryBtnText: { fontSize: 16, fontWeight: '700' },
  secondaryBtn: { paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  secondaryBtnText: { fontSize: 15, fontWeight: '600' },
  doneBody: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  result: { fontSize: 26, fontWeight: '700', textAlign: 'center' },
  newBest: { fontSize: 17, fontWeight: '700', textAlign: 'center', marginTop: 10 },
  bestLine: { fontSize: 14, textAlign: 'center', marginTop: 8, marginBottom: 24 },
  empty: { fontSize: 14, textAlign: 'center', marginTop: 40, paddingHorizontal: 24 },
});
