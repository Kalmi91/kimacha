import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { getDb } from '@/lib/database';
import { getGameDef, gameName, type GameId } from '@/lib/games/registry';
import { getGameBest, recordGameResult } from '@/lib/games/scoring';
import { loadVoices, hasVoiceFor, speak } from '@/lib/speech';
import { speechLang } from '@/lib/languages';
import { useLoadOnMount } from '@/lib/useLoadOnMount';
import {
  buildDictationItem,
  canonicalAnswer,
  checkDictation,
  numberRangeForLevel,
  type DictationItem,
  type DictationMode,
} from '@/lib/games/dictation';

// FB187, Kálmán 2026-09-08: „szám és dátum gyakorlásra is kell egy játék. Olyan ami
// mondja spanyolul nekem meg le kell írnom akár a számot akár a dátumot. legyen két
// külön."  Két külön játék, de EGY képernyő-motor: a mód csak azt dönti el, mit
// generálunk és mit mondunk ki. A válasz elfogadása szándékosan bőkezű (Kálmán:
// „mindegyiket fogadja el"), a részleteket a lib/games/dictation.ts tartja.
//
// A felolvasás a lényeg, ezért ha nincs telepített spanyol hang, a kimondott alak
// írásban jelenik meg: a játék így is gyakoroltat, csak hallás helyett olvasva.

const ROUND_LENGTH = 10;

export default function DictationGame({ gameId, mode }: { gameId: GameId; mode: DictationMode }) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();
  const router = useRouter();
  const gameDef = getGameDef(gameId)!;

  const [contentLang, setContentLang] = useState('hu');
  const [learnedLang, setLearnedLang] = useState('es');
  const [range, setRange] = useState(100);
  const [canSpeak, setCanSpeak] = useState(false);
  const [best, setBest] = useState(0);

  const [runSeed, setRunSeed] = useState(() => Math.floor(Math.random() * 100000));
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [done, setDone] = useState(false);
  const [isNewBest, setIsNewBest] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const load = useCallback(async () => {
    const db = getDb();
    const onboarding = await db.getOnboarding();
    const source = onboarding?.source ?? 'hu';
    const target = onboarding?.target ?? 'es';
    setLearnedLang(target);
    setContentLang(source === 'hu' || source === 'es' || source === 'de' ? source : 'en');

    const levelData = await db.getLevel();
    setRange(numberRangeForLevel(levelData.level));

    const bestRow = await getGameBest(gameId);
    setBest(bestRow?.bestScore ?? 0);

    await loadVoices();
    setCanSpeak(hasVoiceFor(speechLang(target)));
  }, [gameId]);

  useLoadOnMount(load);

  const item: DictationItem = buildDictationItem(mode, runSeed + index, range);

  const say = useCallback(() => {
    if (canSpeak) speak(item.spoken, speechLang(learnedLang));
  }, [canSpeak, item.spoken, learnedLang]);

  // Minden új tétel egyszer elhangzik magától, utána a 🔊 gombbal ismételhető.
  useEffect(() => {
    if (done) return;
    say();
  }, [done, say]);

  const check = () => {
    if (result) return;
    const ok = checkDictation(item, typed);
    setResult(ok ? 'correct' : 'wrong');
    if (ok) setCorrectCount((c) => c + 1);
  };

  const next = async () => {
    if (index + 1 >= ROUND_LENGTH) {
      const outcome = await recordGameResult(gameId, correctCount);
      setIsNewBest(outcome.isNewBest);
      setBest(outcome.best);
      setDone(true);
      return;
    }
    setIndex(index + 1);
    setTyped('');
    setResult(null);
    inputRef.current?.focus();
  };

  const again = () => {
    setRunSeed(Math.floor(Math.random() * 100000));
    setIndex(0);
    setTyped('');
    setResult(null);
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
        {done ? '' : `${index + 1}/${ROUND_LENGTH}`}
      </Text>
    </View>
  );

  if (done) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {header}
        <View style={styles.doneBody}>
          <Text style={[styles.result, { color: colors.text }]}>
            {s.games.dictation.result(correctCount, ROUND_LENGTH)}
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
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {header}
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.prompt, { color: colors.tabIconDefault }]}>
          {mode === 'number' ? s.games.dictation.promptNumber : s.games.dictation.promptDate}
        </Text>

        <Pressable style={[styles.speakBtn, { backgroundColor: colors.card }]} onPress={say}>
          <Text style={styles.speakIcon}>🔊</Text>
        </Pressable>

        {/* Hang nélküli eszközön a kimondott alak írásban jön, különben a játék
            elindíthatatlan lenne (a 🔊 gomb ilyenkor néma). */}
        {!canSpeak && (
          <Text style={[styles.spokenFallback, { color: colors.text }]}>{item.spoken}</Text>
        )}

        <TextInput
          ref={inputRef}
          style={[styles.input, { color: colors.text, borderColor: result ? (result === 'correct' ? '#2e7d32' : '#c62828') : colors.tabIconDefault }]}
          value={typed}
          onChangeText={setTyped}
          onSubmitEditing={result ? next : check}
          editable={!result}
          placeholder={s.games.dictation.placeholder}
          placeholderTextColor={colors.tabIconDefault}
          autoFocus
          autoCorrect={false}
          autoCapitalize="none"
        />

        {result && (
          <Text style={[styles.answer, { color: result === 'correct' ? '#2e7d32' : '#c62828' }]}>
            {result === 'correct' ? s.games.dictation.correct : canonicalAnswer(item)}
          </Text>
        )}

        <Pressable style={[styles.primaryBtn, { backgroundColor: colors.tint }]} onPress={result ? next : check}>
          <Text style={[styles.primaryBtnText, { color: colors.background }]}>
            {result ? s.games.dictation.next : s.games.dictation.check}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
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
  content: { paddingHorizontal: 20, paddingBottom: 40, alignItems: 'center' },
  prompt: { fontSize: 14, marginTop: 20, textAlign: 'center' },
  speakBtn: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 22,
  },
  speakIcon: { fontSize: 40 },
  spokenFallback: { fontSize: 26, fontWeight: '700', marginBottom: 18, textAlign: 'center' },
  input: {
    width: '100%',
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 22,
    textAlign: 'center',
  },
  answer: { fontSize: 18, fontWeight: '600', marginTop: 16, textAlign: 'center' },
  primaryBtn: { width: '100%', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  primaryBtnText: { fontSize: 16, fontWeight: '700' },
  secondaryBtn: { paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  secondaryBtnText: { fontSize: 15, fontWeight: '600' },
  doneBody: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  result: { fontSize: 26, fontWeight: '700', textAlign: 'center' },
  newBest: { fontSize: 17, fontWeight: '700', textAlign: 'center', marginTop: 10 },
  bestLine: { fontSize: 14, textAlign: 'center', marginTop: 8, marginBottom: 24 },
});
