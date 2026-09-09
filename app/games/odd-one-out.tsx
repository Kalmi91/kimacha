import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { getDb } from '@/lib/database';
import { findWordById, genderOf, normalizeWordToken, type Level } from '@/data/words';
import { getTopicsForLevel, getTopicName } from '@/data/topics';
import { getGameDef, gameName } from '@/lib/games/registry';
import { getLearnedPool } from '@/lib/games/vocabPool';
import { buildOddOneOutRound, type OddCategorySet, type OddRound, type OddWordMeta } from '@/lib/games/oddOneOut';
import { hashString } from '@/lib/shuffle';
import { getGameBest, recordGameResult } from '@/lib/games/scoring';
import GlossText from '@/components/games/GlossText';
import GameSettingsSheet, { type SettingField } from '@/components/games/GameSettingsSheet';
import type { GlossInfo } from '@/lib/games/gloss';
import { useLoadOnMount } from '@/lib/useLoadOnMount';

// GAMES.md 4.8 (F5, odd-one-out). 4 words, tap the one that doesn't belong,
// the "common thread" is ALWAYS shown after answering (K6's teaching-not-
// just-testing requirement), so this is closer in shape to grammar-choice.tsx
// (a run of N questions, each answered then explained) than to bubble-pop's
// falling-tile arcade loop, even though the underlying round-builder
// (lib/games/oddOneOut.ts) is the same category-grouping approach bubblePop
// pioneered (topic/pos/gender metadata from F-1's pos/gender fields, GAMES.md
// K6). GAMES.md 4.10 (ccat) reuses buildOddOneOutRound for its own
// "kakukktojás" item type instead of a second implementation.

type Screen = 'playing' | 'summary';
type Difficulty = 'topic' | 'pos' | 'mixed';
type TimeLimit = 'none' | '15' | '10';

const QUESTION_COUNTS = [10, 15, 20];
const MIXED_SETS: OddCategorySet[] = ['topic', 'pos', 'gender'];

function posLabel(pos: string, sPos: { posNoun: string; posVerb: string; posAdj: string; posAdv: string }): string {
  if (pos === 'noun') return sPos.posNoun;
  if (pos === 'verb') return sPos.posVerb;
  if (pos === 'adj') return sPos.posAdj;
  return sPos.posAdv;
}

export default function OddOneOutScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();
  const router = useRouter();
  const gameDef = getGameDef('odd-one-out')!;

  const [learnedLang, setLearnedLang] = useState('es');
  const [contentLang, setContentLang] = useState('hu');
  const [level, setLevel] = useState<Level>('A1');

  const [questionCount, setQuestionCount] = useState(10);
  const [difficulty, setDifficulty] = useState<Difficulty>('topic');
  const [timeLimit, setTimeLimit] = useState<TimeLimit>('none');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [meta, setMeta] = useState<OddWordMeta[]>([]);
  const [best, setBest] = useState(0);
  const [screen, setScreen] = useState<Screen>('playing');
  const [index, setIndex] = useState(0);
  const [round, setRound] = useState<OddRound | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [clock, setClock] = useState<number | null>(null);
  const [reveal, setReveal] = useState<GlossInfo | null>(null);
  const [gameOverEarly, setGameOverEarly] = useState(false);

  const lastCategoryRef = useRef<string | undefined>(undefined);
  const roundKeyRef = useRef(0);
  const clockIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopClock = () => {
    if (clockIntervalRef.current) {
      clearInterval(clockIntervalRef.current);
      clockIntervalRef.current = null;
    }
  };

  const load = useCallback(async () => {
    const db = getDb();
    const onboarding = await db.getOnboarding();
    const source = onboarding?.source ?? 'hu';
    const target = onboarding?.target ?? 'es';
    setLearnedLang(target);
    setContentLang(source === 'hu' || source === 'es' || source === 'de' ? source : 'en');

    const levelData = await db.getLevel();
    const lvl = levelData.level as Level;
    setLevel(lvl);

    const savedSettings = await db.getGameSettings('odd-one-out');
    const savedCount = (savedSettings?.questionCount as number) ?? 10;
    const savedDifficulty = (savedSettings?.difficulty as Difficulty) ?? 'topic';
    const savedTimeLimit = (savedSettings?.timeLimit as TimeLimit) ?? 'none';
    const count = QUESTION_COUNTS.includes(savedCount) ? savedCount : 10;
    const diff: Difficulty = ['topic', 'pos', 'mixed'].includes(savedDifficulty) ? savedDifficulty : 'topic';
    const tl: TimeLimit = ['none', '15', '10'].includes(savedTimeLimit) ? savedTimeLimit : 'none';
    setQuestionCount(count);
    setDifficulty(diff);
    setTimeLimit(tl);

    const bestRow = await getGameBest('odd-one-out');
    setBest(bestRow?.bestScore ?? 0);

    const pool = await getLearnedPool({ pair: `${source}-${target}`, learnedLang: target, level: lvl, minSize: 60 });
    const m: OddWordMeta[] = pool.map((e) => {
      const word = findWordById(e.wordId, target);
      return { wordId: e.wordId, learned: e.learned, native: e.native, isNew: e.isNew, topicId: e.topicId, pos: word?.pos, gender: genderOf(word, target) };
    });
    setMeta(m);

    lastCategoryRef.current = undefined;
    roundKeyRef.current = 0;
    setIndex(0);
    setCorrectCount(0);
    setScreen('playing');
    setGameOverEarly(false);
    return { m, diff, count, tl };
    // The setters are listed because the React Compiler infers them as
    // dependencies of this async callback; they are stable, so nothing changes
    // at runtime, but an empty array here counts as broken memoization.
  }, [setQuestionCount, setDifficulty, setTimeLimit]);

  const startClock = useCallback((seconds: number, onExpire: () => void) => {
    stopClock();
    setClock(seconds);
    clockIntervalRef.current = setInterval(() => {
      setClock((v) => {
        if (v === null) return null;
        if (v <= 1) {
          stopClock();
          onExpire();
          return null;
        }
        return v - 1;
      });
    }, 1000);
  }, []);

  const handleTimeout = (r: OddRound) => {
    setAnswered(true);
    setSelected(null);
    const oddWordId = r.items[r.oddIndex].wordId;
    getDb().recordAttempt(oddWordId, 'game:odd-one-out', false, 0).catch(() => {});
  };

  const buildNextRound = useCallback(
    (pool: OddWordMeta[], diff: Difficulty, tl: TimeLimit) => {
      stopClock();
      setSelected(null);
      setAnswered(false);
      setReveal(null);

      let built: OddRound | null = null;
      for (let attempt = 0; attempt < 6 && !built; attempt++) {
        const categorySet: OddCategorySet =
          diff === 'mixed' ? MIXED_SETS[hashString(`mix:${roundKeyRef.current}:${attempt}`) % MIXED_SETS.length] : diff;
        const seed = hashString(`${categorySet}:${roundKeyRef.current}:${attempt}`);
        built = buildOddOneOutRound(pool, categorySet, seed, lastCategoryRef.current);
      }
      if (!built) {
        for (let attempt = 0; attempt < 4 && !built; attempt++) {
          const seed = hashString(`fallback:${roundKeyRef.current}:${attempt}`);
          built = buildOddOneOutRound(pool, 'topic', seed);
        }
      }
      roundKeyRef.current += 1;

      if (!built) {
        setGameOverEarly(true);
        setScreen('summary');
        recordGameResult('odd-one-out', correctCount).then((r) => setBest(r.best));
        return;
      }

      lastCategoryRef.current = built.categoryValue;
      setRound(built);

      if (tl !== 'none') {
        startClock(Number(tl), () => handleTimeout(built!));
      }
    },
    [correctCount, startClock]
  );

  const start = useCallback(
    () =>
      load().then(({ m, diff, count, tl }) => {
        if (m.length > 0) buildNextRound(m, diff, tl);
      }),
    // buildNextRound is left out on purpose: the first round is built once, on
    // mount, and buildNextRound changes with the score.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [load]
  );
  useLoadOnMount(start);

  useEffect(() => {
    return () => stopClock();
  }, []);

  const selectOption = (i: number) => {
    if (answered || !round) return;
    stopClock();
    setSelected(i);
    setAnswered(true);
    const correct = i === round.oddIndex;
    if (correct) setCorrectCount((c) => c + 1);
    const oddWordId = round.items[round.oddIndex].wordId;
    getDb().recordAttempt(oddWordId, 'game:odd-one-out', correct, 0).catch(() => {});
  };

  const handleReveal = (item: OddWordMeta) => {
    stopClock();
    setReveal({ wordId: item.wordId, learned: item.learned, native: item.native, isNew: item.isNew });
  };

  const next = () => {
    if (index + 1 >= questionCount) {
      recordGameResult('odd-one-out', correctCount).then((r) => setBest(r.best));
      setScreen('summary');
      return;
    }
    setIndex((i) => i + 1);
    buildNextRound(meta, difficulty, timeLimit);
  };

  const categoryDisplay = (set: OddCategorySet, value: string): string => {
    if (set === 'topic') {
      const topic = getTopicsForLevel(level, learnedLang).find((tp) => tp.id === value);
      return topic ? getTopicName(topic, contentLang) : value;
    }
    if (set === 'pos') return posLabel(value, s.games.bubblePop);
    if (value === 'm') return s.games.bubblePop.genderM;
    return value === 'n' ? s.games.bubblePop.genderN : s.games.bubblePop.genderF;
  };

  const saveSettings = (next2: { questionCount: number; difficulty: Difficulty; timeLimit: TimeLimit }) => {
    getDb().setGameSettings('odd-one-out', next2).catch(() => {});
  };

  const restart = () => {
    load().then(({ m, diff, count, tl }) => {
      if (m.length > 0) buildNextRound(m, diff, tl);
    });
  };

  const settingsFields: SettingField[] = [
    {
      key: 'questionCount',
      type: 'select',
      label: s.games.oddOneOut.questionCountLabel,
      options: QUESTION_COUNTS.map((n) => ({ value: String(n), label: String(n) })),
    },
    {
      key: 'difficulty',
      type: 'select',
      label: s.games.oddOneOut.difficultyLabel,
      options: [
        { value: 'topic', label: s.games.oddOneOut.difficultyTopic },
        { value: 'pos', label: s.games.oddOneOut.difficultyPos },
        { value: 'mixed', label: s.games.oddOneOut.difficultyMixed },
      ],
    },
    {
      key: 'timeLimit',
      type: 'select',
      label: s.games.oddOneOut.timeLimitLabel,
      options: [
        { value: 'none', label: s.games.oddOneOut.timeLimitNone },
        { value: '15', label: '15s' },
        { value: '10', label: '10s' },
      ],
    },
  ];

  if (screen === 'summary') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', gap: 16 }]}>
        <Text style={[styles.summaryTitle, { color: colors.text }]}>{s.games.summaryTitle}</Text>
        <Text style={[styles.summaryScore, { color: colors.tint }]}>{s.games.summaryScore(correctCount, gameOverEarly ? index : questionCount)}</Text>
        <Text style={[styles.cardSub, { color: colors.tabIconDefault }]}>
          {s.games.best}: {best}
        </Text>
        <View style={styles.summaryButtons}>
          <Pressable style={[styles.btn, styles.btnGhost, { borderColor: colors.tint }]} onPress={() => router.back()}>
            <Text style={[styles.btnGhostText, { color: colors.tint }]}>{s.games.backToHub}</Text>
          </Pressable>
          <Pressable style={[styles.btn, { backgroundColor: colors.tint }]} onPress={restart}>
            <Text style={styles.btnText}>{s.games.playAgain}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!round) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={[styles.back, { color: colors.text }]}>←</Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>{gameName(gameDef, contentLang)}</Text>
          <View style={{ width: 24 }} />
        </View>
      </View>
    );
  }

  const oddItem = round.items[round.oddIndex];
  const commonThreadLabel = categoryDisplay(round.categorySet, round.categoryValue);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={[styles.back, { color: colors.text }]}>←</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {gameName(gameDef, contentLang)}
        </Text>
        <Pressable onPress={() => setSettingsOpen(true)} hitSlop={12}>
          <Text style={styles.settingsBtnText}>⚙️</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.playBody}>
        <View style={styles.progressRow}>
          <Text style={[styles.progress, { color: colors.tabIconDefault }]}>{s.games.oddOneOut.progress(index + 1, questionCount)}</Text>
          {clock !== null ? <Text style={[styles.progress, { color: colors.tint }]}>⏱ {clock}s</Text> : null}
        </View>
        <Text style={[styles.prompt, { color: colors.text }]}>{s.games.oddOneOut.prompt}</Text>

        <View style={styles.grid}>
          {round.items.map((item, i) => {
            const isOdd = i === round.oddIndex;
            const isPicked = selected === i;
            let bg = colors.card;
            let border = colors.tabIconDefault;
            if (answered && isOdd) {
              bg = '#22C55E22';
              border = '#22C55E';
            } else if (answered && isPicked && !isOdd) {
              bg = '#EF444422';
              border = '#EF4444';
            }
            return (
              <Pressable
                key={item.wordId}
                testID="odd-option"
                style={[styles.tile, { backgroundColor: bg, borderColor: border }]}
                onPress={() => selectOption(i)}
                onLongPress={() => handleReveal(item)}
                delayLongPress={400}
                disabled={answered}
              >
                <Text
                  style={[
                    styles.tileText,
                    { color: colors.text },
                    item.isNew ? { color: colors.tabIconDefault, textDecorationLine: 'underline', textDecorationStyle: 'dotted' } : null,
                  ]}
                  numberOfLines={2}
                >
                  {item.learned}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {answered ? (
          <View style={[styles.explainCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.explainHeader, { color: selected === round.oddIndex ? '#22C55E' : '#EF4444' }]}>
              {selected === round.oddIndex ? s.games.correctFeedback : s.games.wrongFeedback}
            </Text>
            <Text style={[styles.explainText, { color: colors.text }]}>{s.games.oddOneOut.commonThread(commonThreadLabel)}</Text>
            <Text style={[styles.explainText, { color: colors.tabIconDefault }]}>
              {oddItem.learned} = {oddItem.native}
            </Text>
            <Pressable style={[styles.btn, { backgroundColor: colors.tint, marginTop: 12 }]} onPress={next}>
              <Text style={styles.btnText}>{s.games.understood}</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      {reveal ? (
        <View style={styles.revealOverlayWrap} pointerEvents="box-none">
          <GlossText
            text={reveal.learned}
            glosses={new Map([[normalizeWordToken(reveal.learned), reveal]])}
            learnedLang={learnedLang}
            disableTap
            forceOpen={reveal}
            onForceClose={() => setReveal(null)}
            style={styles.hiddenAnchor}
          />
        </View>
      ) : null}

      <GameSettingsSheet
        visible={settingsOpen}
        title={s.games.settings}
        fields={settingsFields}
        values={{ questionCount, difficulty, timeLimit }}
        onChange={(key, value) => {
          if (key === 'questionCount') {
            const next2 = Number(value);
            setQuestionCount(next2);
            saveSettings({ questionCount: next2, difficulty, timeLimit });
          } else if (key === 'difficulty') {
            const next2 = value as Difficulty;
            setDifficulty(next2);
            saveSettings({ questionCount, difficulty: next2, timeLimit });
          } else if (key === 'timeLimit') {
            const next2 = value as TimeLimit;
            setTimeLimit(next2);
            saveSettings({ questionCount, difficulty, timeLimit: next2 });
          }
        }}
        onClose={() => {
          setSettingsOpen(false);
          restart();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  back: { fontSize: 22 },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600' },
  settingsBtnText: { fontSize: 20 },
  playBody: { padding: 16, gap: 14, alignItems: 'center' },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  progress: { fontSize: 13, fontWeight: '600' },
  prompt: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
  },
  tile: {
    width: '46%',
    minHeight: 72,
    borderWidth: 2,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  tileText: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  explainCard: { borderRadius: 16, padding: 16, gap: 8, width: '100%' },
  explainHeader: { fontSize: 16, fontWeight: '700' },
  explainText: { fontSize: 14, lineHeight: 20 },
  btn: { paddingVertical: 14, borderRadius: 24, alignItems: 'center' },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1 },
  btnGhostText: { fontWeight: '600' },
  btnText: { color: '#FFFFFF', fontWeight: '700' },
  cardSub: { fontSize: 13 },
  summaryTitle: { fontSize: 28, fontWeight: '800' },
  summaryScore: { fontSize: 22, fontWeight: '700' },
  summaryButtons: { flexDirection: 'row', gap: 12 },
  revealOverlayWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  hiddenAnchor: { width: 0, height: 0 },
});
