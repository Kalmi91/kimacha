import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { getDb } from '@/lib/database';
import { findWordById, type Level } from '@/data/words';
import { getGameDef, gameName } from '@/lib/games/registry';
import { getLearnedPool } from '@/lib/games/vocabPool';
import {
  buildConjugationRound,
  IRREGULAR_INFINITIVES,
  PERSON_LABEL,
  TENSES,
  type ConjugationCandidate,
  type ConjugationRound,
  type Tense,
} from '@/lib/games/conjugate';
import { hashString } from '@/lib/shuffle';
import { getGameBest, recordGameResult } from '@/lib/games/scoring';
import GameSettingsSheet, { type SettingField } from '@/components/games/GameSettingsSheet';

// GAMES.md 4.7 (F5, conjugation-slot). K15: Spanish only, the hub card shows
// "soon" for every other learned language (registry.ts `languages: ['es']`
// + app/(tabs)/games.tsx), this screen defensively shows the same
// "comingSoon" message if it's ever reached with a non-Spanish pair.
//
// Loop shape follows odd-one-out.tsx (a run of N questions, each answered
// then explained), not bubble-pop's arcade loop: a wrong conjugation should
// always be explained before moving on (GAMES.md 4.7 "Rossz válasz után egy
// soros magyarázat"), same reasoning as odd-one-out's "always show the common
// thread". The 3-option round itself comes from lib/games/conjugate.ts,
// which is the only place verb forms are generated/tabled (GAMES.md 3.6's
// "tényállítás" rule: this screen never invents a form).

type Screen = 'playing' | 'summary';
type TimeLimit = 'none' | '5' | '3';

const QUESTION_COUNTS = [10, 20, 30];
const TENSE_KEYS = TENSES.map((tense) => `tense_${tense}` as const);

export default function ConjugationSlotScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();
  const router = useRouter();
  const gameDef = getGameDef('conjugation-slot')!;

  const [learnedLang, setLearnedLang] = useState('es');
  const [contentLang, setContentLang] = useState('hu');
  const [ready, setReady] = useState(false);

  const [questionCount, setQuestionCount] = useState(20);
  const [tenseFlags, setTenseFlags] = useState<Record<Tense, boolean>>({
    presente: true,
    indefinido: true,
    imperfecto: false,
    futuro: false,
    condicional: false,
    subjuntivo_presente: false,
  });
  const [includeIrregular, setIncludeIrregular] = useState(true);
  const [timeLimit, setTimeLimit] = useState<TimeLimit>('none');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [candidates, setCandidates] = useState<ConjugationCandidate[]>([]);
  const [nativeByInfinitive, setNativeByInfinitive] = useState<Map<string, string>>(new Map());
  const [best, setBest] = useState(0);
  const [screen, setScreen] = useState<Screen>('playing');
  const [index, setIndex] = useState(0);
  const [round, setRound] = useState<ConjugationRound | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [clock, setClock] = useState<number | null>(null);
  const [gameOverEarly, setGameOverEarly] = useState(false);

  const roundKeyRef = useRef(0);
  const clockIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopClock = () => {
    if (clockIntervalRef.current) {
      clearInterval(clockIntervalRef.current);
      clockIntervalRef.current = null;
    }
  };

  const activeTenses = (flags: Record<Tense, boolean>): Tense[] => TENSES.filter((tn) => flags[tn]);

  const load = useCallback(async () => {
    const db = getDb();
    const onboarding = await db.getOnboarding();
    const source = onboarding?.source ?? 'hu';
    const target = onboarding?.target ?? 'es';
    setLearnedLang(target);
    setContentLang(source === 'hu' || source === 'es' || source === 'de' ? source : 'en');
    setReady(target === 'es');

    const levelData = await db.getLevel();
    const lvl = levelData.level as Level;

    const savedSettings = await db.getGameSettings('conjugation-slot');
    const savedCount = (savedSettings?.questionCount as number) ?? 20;
    const count = QUESTION_COUNTS.includes(savedCount) ? savedCount : 20;
    const savedTenses = (savedSettings?.tenses as Tense[]) ?? undefined;
    // FB162 follow-up (Kálmán, 2026-08-29): "menjen minden idő". The playtest asked
    // whether the default should shrink to the present, because A0/A1 has not met the
    // preterite yet; the answer went the other way, all six tenses are on by default
    // and the ⚙️ sheet narrows them.
    const flags: Record<Tense, boolean> = {
      presente: savedTenses ? savedTenses.includes('presente') : true,
      indefinido: savedTenses ? savedTenses.includes('indefinido') : true,
      imperfecto: savedTenses ? savedTenses.includes('imperfecto') : true,
      futuro: savedTenses ? savedTenses.includes('futuro') : true,
      condicional: savedTenses ? savedTenses.includes('condicional') : true,
      subjuntivo_presente: savedTenses ? savedTenses.includes('subjuntivo_presente') : true,
    };
    const savedIrregular = (savedSettings?.includeIrregular as boolean) ?? true;
    const savedTimeLimit = (savedSettings?.timeLimit as TimeLimit) ?? 'none';
    const tl: TimeLimit = ['none', '5', '3'].includes(savedTimeLimit) ? savedTimeLimit : 'none';
    setQuestionCount(count);
    setTenseFlags(flags);
    setIncludeIrregular(savedIrregular);
    setTimeLimit(tl);

    const bestRow = await getGameBest('conjugation-slot');
    setBest(bestRow?.bestScore ?? 0);

    let cands: ConjugationCandidate[] = [];
    let nativeMap = new Map<string, string>();
    if (target === 'es') {
      const pool = await getLearnedPool({ pair: `${source}-${target}`, learnedLang: target, level: lvl, minSize: 60 });
      const infinitiveRe = /^[a-záéíóúñ]+(ar|er|ir)$/i;
      const seenInf = new Set<string>();
      for (const entry of pool) {
        const word = findWordById(entry.wordId, target);
        if (!word || word.pos !== 'verb') continue;
        const inf = entry.learned.trim();
        if (!infinitiveRe.test(inf) || inf.endsWith('arse') || inf.endsWith('erse') || inf.endsWith('irse')) continue;
        if (seenInf.has(inf)) continue;
        seenInf.add(inf);
        cands.push({ wordId: entry.wordId, infinitive: inf, isNew: entry.isNew });
        nativeMap.set(inf, entry.native);
      }
    }
    setCandidates(cands);
    setNativeByInfinitive(nativeMap);

    roundKeyRef.current = 0;
    setIndex(0);
    setCorrectCount(0);
    setScreen('playing');
    setGameOverEarly(false);
    return { cands, flags, irregular: savedIrregular, count, tl };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleTimeout = () => {
    setAnswered(true);
    setSelected(null);
    if (round) getDb().recordAttempt(round.wordId, 'game:conjugation-slot', false, 0).catch(() => {});
  };

  const buildNextRound = useCallback(
    (pool: ConjugationCandidate[], flags: Record<Tense, boolean>, irregular: boolean, tl: TimeLimit) => {
      stopClock();
      setSelected(null);
      setAnswered(false);

      const scoped = irregular ? pool : pool.filter((c) => !IRREGULAR_INFINITIVES.has(c.infinitive));
      const tenses = activeTenses(flags);
      const seed = hashString(`conj:${roundKeyRef.current}`);
      const built = buildConjugationRound(scoped, tenses, seed);
      roundKeyRef.current += 1;

      if (!built) {
        setGameOverEarly(true);
        setScreen('summary');
        recordGameResult('conjugation-slot', correctCount).then((r) => setBest(r.best));
        return;
      }

      setRound(built);
      if (tl !== 'none') {
        startClock(Number(tl), () => handleTimeout());
      }
    },
    // handleTimeout is left out on purpose: it is recreated every render, so
    // listing it would rebuild buildNextRound on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [correctCount, startClock]
  );

  useEffect(() => {
    load().then(({ cands, flags, irregular, count, tl }) => {
      if (cands.length > 0 && activeTenses(flags).length > 0) buildNextRound(cands, flags, irregular, tl);
    });
    return () => stopClock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectOption = (opt: string) => {
    if (answered || !round) return;
    stopClock();
    setSelected(opt);
    setAnswered(true);
    const correct = opt === round.correct;
    if (correct) setCorrectCount((c) => c + 1);
    getDb().recordAttempt(round.wordId, 'game:conjugation-slot', correct, 0).catch(() => {});
  };

  const next = () => {
    if (index + 1 >= questionCount) {
      recordGameResult('conjugation-slot', correctCount).then((r) => setBest(r.best));
      setScreen('summary');
      return;
    }
    setIndex((i) => i + 1);
    buildNextRound(candidates, tenseFlags, includeIrregular, timeLimit);
  };

  const saveSettings = (next2: { questionCount: number; tenses: Tense[]; includeIrregular: boolean; timeLimit: TimeLimit }) => {
    getDb().setGameSettings('conjugation-slot', next2).catch(() => {});
  };

  const restart = () => {
    load().then(({ cands, flags, irregular, count, tl }) => {
      if (cands.length > 0 && activeTenses(flags).length > 0) buildNextRound(cands, flags, irregular, tl);
    });
  };

  const tenseLabel = (tense: Tense): string => s.games.conjugationSlot.tenseNames[tense];

  const settingsFields: SettingField[] = [
    ...TENSE_KEYS.map((key, i) => ({ key, type: 'toggle' as const, label: tenseLabel(TENSES[i]) })),
    { key: 'includeIrregular', type: 'toggle', label: s.games.conjugationSlot.includeIrregularLabel },
    {
      key: 'questionCount',
      type: 'select',
      label: s.games.conjugationSlot.questionCountLabel,
      options: QUESTION_COUNTS.map((n) => ({ value: String(n), label: String(n) })),
    },
    {
      key: 'timeLimit',
      type: 'select',
      label: s.games.conjugationSlot.timeLimitLabel,
      options: [
        { value: 'none', label: s.games.conjugationSlot.timeLimitNone },
        { value: '5', label: '5s' },
        { value: '3', label: '3s' },
      ],
    },
  ];

  const settingsValues: Record<string, string | number | boolean> = {
    ...Object.fromEntries(TENSE_KEYS.map((key, i) => [key, tenseFlags[TENSES[i]]])),
    includeIrregular,
    questionCount,
    timeLimit,
  };

  const handleSettingsChange = (key: string, value: string | number | boolean) => {
    if (key === 'questionCount') {
      const n = Number(value);
      setQuestionCount(n);
      saveSettings({ questionCount: n, tenses: activeTenses(tenseFlags), includeIrregular, timeLimit });
    } else if (key === 'includeIrregular') {
      const v = !!value;
      setIncludeIrregular(v);
      saveSettings({ questionCount, tenses: activeTenses(tenseFlags), includeIrregular: v, timeLimit });
    } else if (key === 'timeLimit') {
      const v = value as TimeLimit;
      setTimeLimit(v);
      saveSettings({ questionCount, tenses: activeTenses(tenseFlags), includeIrregular, timeLimit: v });
    } else if (key.startsWith('tense_')) {
      const tense = key.slice('tense_'.length) as Tense;
      const nextFlags = { ...tenseFlags, [tense]: !!value };
      setTenseFlags(nextFlags);
      saveSettings({ questionCount, tenses: activeTenses(nextFlags), includeIrregular, timeLimit });
    }
  };

  if (!ready) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={[styles.back, { color: colors.text }]}>←</Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>{gameName(gameDef, contentLang)}</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centerBody}>
          <Text style={[styles.comingSoon, { color: colors.tabIconDefault }]}>{s.games.conjugationSlot.comingSoon}</Text>
        </View>
      </View>
    );
  }

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
        <View style={styles.centerBody}>
          <Text style={[styles.comingSoon, { color: colors.tabIconDefault }]}>{s.games.conjugationSlot.notEnoughVerbs}</Text>
        </View>
      </View>
    );
  }

  const nativeGloss = round.isNew ? nativeByInfinitive.get(round.infinitive) : undefined;

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
          <Text style={[styles.progress, { color: colors.tabIconDefault }]}>{s.games.conjugationSlot.progress(index + 1, questionCount)}</Text>
          {clock !== null ? <Text style={[styles.progress, { color: colors.tint }]}>⏱ {clock}s</Text> : null}
        </View>

        <Text style={[styles.prompt, { color: colors.text }]}>
          {PERSON_LABEL[round.person]} ___ <Text style={{ color: colors.tabIconDefault }}>({round.infinitive})</Text>
        </Text>
        {nativeGloss ? <Text style={[styles.gloss, { color: colors.tabIconDefault }]}>{round.infinitive} = {nativeGloss}</Text> : null}

        <View style={styles.options}>
          {round.options.map((opt) => {
            const isCorrect = opt === round.correct;
            const isPicked = selected === opt;
            let bg = colors.card;
            let border = colors.tabIconDefault;
            if (answered && isCorrect) {
              bg = '#22C55E22';
              border = '#22C55E';
            } else if (answered && isPicked && !isCorrect) {
              bg = '#EF444422';
              border = '#EF4444';
            }
            return (
              <Pressable
                key={opt}
                testID="conj-option"
                style={[styles.optionBtn, { backgroundColor: bg, borderColor: border }]}
                onPress={() => selectOption(opt)}
                disabled={answered}
              >
                <Text style={[styles.optionText, { color: colors.text }]}>{opt}</Text>
              </Pressable>
            );
          })}
        </View>

        {answered ? (
          <View style={[styles.explainCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.explainHeader, { color: selected === round.correct ? '#22C55E' : '#EF4444' }]}>
              {selected === round.correct ? s.games.correctFeedback : s.games.wrongFeedback}
            </Text>
            <Text style={[styles.explainText, { color: colors.text }]}>
              {s.games.conjugationSlot.explanation(PERSON_LABEL[round.person], tenseLabel(round.tense), round.correct)}
            </Text>
            <Pressable style={[styles.btn, { backgroundColor: colors.tint, marginTop: 12 }]} onPress={next}>
              <Text style={styles.btnText}>{s.games.understood}</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      <GameSettingsSheet
        visible={settingsOpen}
        title={s.games.settings}
        fields={settingsFields}
        values={settingsValues}
        onChange={handleSettingsChange}
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
  centerBody: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  comingSoon: { fontSize: 15, textAlign: 'center' },
  playBody: { padding: 16, gap: 14, alignItems: 'center' },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  progress: { fontSize: 13, fontWeight: '600' },
  prompt: { fontSize: 26, fontWeight: '800', textAlign: 'center' },
  gloss: { fontSize: 14, fontStyle: 'italic' },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
  },
  optionBtn: {
    minWidth: '28%',
    minHeight: 56,
    borderWidth: 2,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionText: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
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
});
