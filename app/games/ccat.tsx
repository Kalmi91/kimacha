import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t, stringsFor } from '@/lib/i18n';
import { getDb } from '@/lib/database';
import { findWordById, genderOf, type Level, type WordGender } from '@/data/words';
import { getTopicsForLevel, getTopicName } from '@/data/topics';
import { getGameDef, gameName } from '@/lib/games/registry';
import { getLearnedPool, type PoolEntry } from '@/lib/games/vocabPool';
import type { OddWordMeta } from '@/lib/games/oddOneOut';
import {
  buildAntonymItem,
  buildSynonymItem,
  buildAnalogyItem,
  buildCcatOddOneOut,
  buildSentenceFillItem,
  buildAnagramItem,
  buildNumberSeriesItem,
  buildWordProblemItem,
  buildInstructionItem,
  type CcatItem,
  type CcatItemKind,
} from '@/lib/games/ccat';
import { shuffleArray, hashString } from '@/lib/shuffle';
import { getGameBest, recordGameResult } from '@/lib/games/scoring';
import GameSettingsSheet, { type SettingField } from '@/components/games/GameSettingsSheet';
import CountdownStart from '@/components/games/CountdownStart';
import { useLoadOnMount } from '@/lib/useLoadOnMount';

// GAMES.md 4.10 (F5, ccat). K17: no spatial items. K18: prompt-chrome
// language switchable, default the learned language. K19: only the short
// practice mode (10-25 items), no 50Q/15min simulation.
//
// Every item type reduces to the same shape for rendering (a prompt block +
// N option tiles + an explanation after answering), so ONE render path
// handles all 9 kinds (buildRenderData below); only two kinds (oddOneOut,
// sentenceFill) carry a nested "round" from the REUSED engines
// (lib/games/oddOneOut.ts, lib/games/grammarChoice.ts) instead of a flat
// options array, GAMES.md's own words: "Ahol a ccat és az odd-one-out
// ugyanazt csinálja, OSZD MEG a motort."

type Screen = 'start' | 'playing' | 'summary';
// GAMES.md 4.10: the real CCAT is 50 questions in 15 minutes and "a tipikus
// buktató nem a nehézség, hanem a TEMPÓ", so the clock belongs to the RUN, not
// to a single question. 'exam' = the real test's pace scaled to the chosen
// question count, 'none' = the untimed practice mode the spec's settings line
// asks for ("idő: arányos vagy »nincs idő« gyakorló-mód").
type TimeLimit = 'none' | 'exam';
type TypeMix = 'all' | 'verbal' | 'logic';
type PromptLangSetting = 'learned' | 'native';

const QUESTION_COUNTS = [10, 15, 25]; // K19: no 50Q simulation
// 50 questions / 15 minutes = 18 s per question, the real CCAT pace.
const EXAM_SECONDS_PER_QUESTION = 18;
const VERBAL_KINDS: CcatItemKind[] = ['antonym', 'synonym', 'analogy', 'oddOneOut', 'sentenceFill', 'instruction'];
const LOGIC_KINDS: CcatItemKind[] = ['anagram', 'numberSeries', 'wordProblem'];

interface RenderData {
  kind: CcatItemKind;
  promptLabel?: string; // small lead-in above the main prompt (e.g. "Complete the analogy")
  promptText: string; // the main question line
  options: string[];
  correctIndex: number;
  explanation: string;
  wordId?: number; // present only for kinds anchored to one real pool word
}

function langCode(code: string): 'hu' | 'en' | 'es' | 'de' {
  return code === 'hu' || code === 'es' || code === 'de' ? code : 'en';
}

export default function CcatScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();
  const router = useRouter();
  const gameDef = getGameDef('ccat')!;

  const [learnedLang, setLearnedLang] = useState('es');
  const [nativeLang, setNativeLang] = useState('hu');
  const [contentLang, setContentLang] = useState('hu');
  const [level, setLevel] = useState<Level>('A1');

  const [questionCount, setQuestionCount] = useState(15);
  const [timeLimit, setTimeLimit] = useState<TimeLimit>('none');
  const [typeMix, setTypeMix] = useState<TypeMix>('all');
  const [promptLangSetting, setPromptLangSetting] = useState<PromptLangSetting>('learned');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [poolEntries, setPoolEntries] = useState<PoolEntry[]>([]);
  const [oddMeta, setOddMeta] = useState<OddWordMeta[]>([]);
  const [best, setBest] = useState(0);
  const [screen, setScreen] = useState<Screen>('start');
  const [countingIn, setCountingIn] = useState(false);
  const [runSeconds, setRunSeconds] = useState(0); // the run's full budget
  const [timeUp, setTimeUp] = useState(false);
  const [index, setIndex] = useState(0);
  const [render, setRender] = useState<RenderData | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [clock, setClock] = useState<number | null>(null);
  const [noContent, setNoContent] = useState(false);

  const [tally, setTally] = useState<Partial<Record<CcatItemKind, { correct: number; total: number }>>>({});
  const [reviewList, setReviewList] = useState<{ kind: CcatItemKind; promptText: string; explanation: string }[]>([]);

  const kindQueueRef = useRef<CcatItemKind[]>([]);
  // The run-clock callback is created once per run, so it needs a ref to read
  // the score at the moment it fires.
  const correctCountRef = useRef(0);
  const roundKeyRef = useRef(0);
  const clockIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopClock = () => {
    if (clockIntervalRef.current) {
      clearInterval(clockIntervalRef.current);
      clockIntervalRef.current = null;
    }
  };

  const kindsFor = (mix: TypeMix): CcatItemKind[] => (mix === 'verbal' ? VERBAL_KINDS : mix === 'logic' ? LOGIC_KINDS : [...VERBAL_KINDS, ...LOGIC_KINDS]);

  const load = useCallback(async () => {
    const db = getDb();
    const onboarding = await db.getOnboarding();
    const source = onboarding?.source ?? 'hu';
    const target = onboarding?.target ?? 'es';
    setLearnedLang(target);
    setNativeLang(source);
    setContentLang(source === 'hu' || source === 'es' || source === 'de' ? source : 'en');

    const levelData = await db.getLevel();
    const lvl = levelData.level as Level;
    setLevel(lvl);

    const savedSettings = await db.getGameSettings('ccat');
    const savedCount = (savedSettings?.questionCount as number) ?? 15;
    const count = QUESTION_COUNTS.includes(savedCount) ? savedCount : 15;
    // Old installs stored a per-question limit ('20' / '15'); both now mean
    // "timed", i.e. the exam-pace run clock.
    const savedTimeLimit = String(savedSettings?.timeLimit ?? 'none');
    const tl: TimeLimit = savedTimeLimit === 'none' ? 'none' : 'exam';
    const savedMix = (savedSettings?.typeMix as TypeMix) ?? 'all';
    const mix: TypeMix = ['all', 'verbal', 'logic'].includes(savedMix) ? savedMix : 'all';
    const savedPromptLang = (savedSettings?.promptLang as PromptLangSetting) ?? 'learned';
    const pl: PromptLangSetting = ['learned', 'native'].includes(savedPromptLang) ? savedPromptLang : 'learned';
    setQuestionCount(count);
    setTimeLimit(tl);
    setTypeMix(mix);
    setPromptLangSetting(pl);

    const bestRow = await getGameBest('ccat');
    setBest(bestRow?.bestScore ?? 0);

    const pool = await getLearnedPool({ pair: `${source}-${target}`, learnedLang: target, level: lvl, minSize: 60 });
    setPoolEntries(pool);
    const meta: OddWordMeta[] = pool.map((e) => {
      const word = findWordById(e.wordId, target);
      return { wordId: e.wordId, learned: e.learned, native: e.native, isNew: e.isNew, topicId: e.topicId, pos: word?.pos, gender: genderOf(word, target) };
    });
    setOddMeta(meta);

    roundKeyRef.current = 0;
    kindQueueRef.current = [];
    correctCountRef.current = 0;
    setIndex(0);
    setCorrectCount(0);
    setTally({});
    setReviewList([]);
    setNoContent(false);
    return { pool, meta, count, tl, mix, pl, lvl, target, source };
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

  // -------------------------------------------------------------------------
  // Per-kind dispatch + localization (ccat.ts stays pure logic, this screen
  // owns sequencing and ALL user-facing text, same split as oddOneOut.tsx).
  // -------------------------------------------------------------------------

  const topicLabel = (lvl: Level, target: string, topicId: string, lang: string): string => {
    const topic = getTopicsForLevel(lvl, target).find((tp) => tp.id === topicId);
    return topic ? getTopicName(topic, lang) : topicId;
  };

  const buildFor = (kind: CcatItemKind, seed: number, ctx: { pool: PoolEntry[]; meta: OddWordMeta[]; target: string; lvl: Level }): CcatItem | null => {
    switch (kind) {
      case 'antonym':
        return buildAntonymItem(ctx.target, seed);
      case 'synonym':
        return buildSynonymItem(ctx.target, seed);
      case 'analogy':
        return buildAnalogyItem(ctx.target, seed);
      case 'oddOneOut':
        return buildCcatOddOneOut(ctx.meta, seed);
      case 'sentenceFill':
        return buildSentenceFillItem(ctx.target, seed);
      case 'anagram':
        return buildAnagramItem(ctx.pool, ctx.target, seed);
      case 'numberSeries':
        return buildNumberSeriesItem(ctx.pool, ctx.target, seed);
      case 'wordProblem':
        return buildWordProblemItem(ctx.target, seed);
      case 'instruction':
        return buildInstructionItem(ctx.meta, seed);
      default:
        return null;
    }
  };

  // K18: the prompt AND its explanation read in the SAME chosen language
  // (learned or native), consistently, using stringsFor(promptLangCode) for
  // every piece of chrome text (including the pos/gender labels reused from
  // bubblePop's i18n, GAMES.md K6 metadata). The one exception is
  // sentenceFill: it reuses grammar-choice's OWN explanation field verbatim
  // (`why[contentLang]`, always the learner's native UI language, no
  // toggle), because that is grammar-choice.tsx's own established behavior
  // and "oszd meg a motort" means sharing that behavior too, not just the
  // round-builder.
  const toRenderData = (kind: CcatItemKind, item: CcatItem, pl: PromptLangSetting, lvl: Level, target: string, source: string): RenderData => {
    const promptLangCode = pl === 'learned' ? target : source;
    const promptLangDisplay = langCode(promptLangCode);
    const promptGameStrings = stringsFor(promptLangCode).games;
    const promptStrings = promptGameStrings.ccat;
    const posLabel = (pos: string): string => {
      if (pos === 'noun') return promptGameStrings.bubblePop.posNoun;
      if (pos === 'verb') return promptGameStrings.bubblePop.posVerb;
      if (pos === 'adj') return promptGameStrings.bubblePop.posAdj;
      return promptGameStrings.bubblePop.posAdv;
    };
    const genderLabel = (gender: WordGender): string =>
      gender === 'f' ? promptGameStrings.bubblePop.genderF
        : gender === 'n' ? promptGameStrings.bubblePop.genderN
          : promptGameStrings.bubblePop.genderM;

    switch (item.kind) {
      case 'antonym':
        return {
          kind,
          promptText: promptStrings.antonymPrompt(item.word),
          options: item.options,
          correctIndex: item.correctIndex,
          explanation: promptStrings.antonymExplanation(item.word, item.options[item.correctIndex]),
        };
      case 'synonym':
        return {
          kind,
          promptText: promptStrings.synonymPrompt(item.word),
          options: item.options,
          correctIndex: item.correctIndex,
          explanation: promptStrings.synonymExplanation(item.word, item.options[item.correctIndex]),
        };
      case 'analogy':
        return {
          kind,
          promptLabel: promptStrings.analogyLabel,
          promptText: `${item.a} : ${item.b} :: ${item.c} : ?`,
          options: item.options,
          correctIndex: item.correctIndex,
          explanation: promptStrings.analogyExplanation(item.a, item.b, item.c, item.options[item.correctIndex]),
        };
      case 'oddOneOut': {
        const commonLabel =
          item.round.categorySet === 'topic'
            ? topicLabel(lvl, target, item.round.categoryValue, promptLangDisplay)
            : item.round.categorySet === 'pos'
              ? posLabel(item.round.categoryValue)
              : genderLabel(item.round.categoryValue as WordGender);
        const oddItem = item.round.items[item.round.oddIndex];
        return {
          kind,
          promptText: promptGameStrings.oddOneOut.prompt,
          options: item.round.items.map((i) => i.learned),
          correctIndex: item.round.oddIndex,
          explanation: promptGameStrings.oddOneOut.commonThread(commonLabel),
          wordId: oddItem.wordId,
        };
      }
      case 'sentenceFill':
        return {
          kind,
          promptText: item.round.item.sentence,
          options: item.round.options,
          correctIndex: item.round.correctIndex,
          explanation: item.round.item.why[contentLang] ?? item.round.item.why.en,
        };
      case 'anagram':
        return {
          kind,
          promptText: promptStrings.anagramPrompt(item.scrambled),
          options: item.options,
          correctIndex: item.correctIndex,
          explanation: promptStrings.anagramExplanation(item.options[item.correctIndex]),
          wordId: item.wordId,
        };
      case 'numberSeries':
        return {
          kind,
          promptLabel: promptStrings.numberSeriesPrompt,
          promptText: `${item.sequence.join(', ')}, ?`,
          options: item.options,
          correctIndex: item.correctIndex,
          explanation: promptStrings.numberSeriesExplanation(item.options[item.correctIndex]),
        };
      case 'wordProblem': {
        const opSymbol = item.item.op === '+' ? '+' : '−';
        return {
          kind,
          promptText: item.item.prompt[promptLangDisplay] ?? item.item.prompt.en,
          options: item.options,
          correctIndex: item.correctIndex,
          explanation: promptStrings.wordProblemCalc(item.item.a, opSymbol, item.item.b, item.item.answer),
        };
      }
      case 'instruction': {
        const tLabel = topicLabel(lvl, target, item.topicId, promptLangDisplay);
        // FB162: the ADJECTIVE ("feminine"), not bubble-pop's plural noun phrase
        // ("feminine words"), which turned this prompt into a broken sentence.
        const gLabel = item.gender === 'f' ? promptStrings.genderAdjF
          : item.gender === 'n' ? promptStrings.genderAdjN
            : promptStrings.genderAdjM;
        const correct = item.options[item.correctIndex];
        return {
          kind,
          promptText: promptStrings.instructionPrompt(tLabel, gLabel),
          options: item.options.map((o) => o.learned),
          correctIndex: item.correctIndex,
          explanation: promptStrings.instructionExplanation(correct.learned, tLabel, gLabel),
          wordId: correct.wordId,
        };
      }
    }
  };

  const buildNextRound = useCallback(
    (
      pool: PoolEntry[],
      meta: OddWordMeta[],
      mix: TypeMix,
      pl: PromptLangSetting,
      tl: TimeLimit,
      lvl: Level,
      target: string,
      source: string
    ) => {
      stopClock();
      setSelected(null);
      setAnswered(false);

      const kinds = kindsFor(mix);
      if (kindQueueRef.current.length === 0) kindQueueRef.current = shuffleArray(kinds, hashString(`ccat-cycle:${roundKeyRef.current}`));

      let built: CcatItem | null = null;
      let usedKind: CcatItemKind = kinds[0];
      for (let attempt = 0; attempt < kinds.length && !built; attempt++) {
        const kind = kindQueueRef.current.shift();
        if (!kind) break;
        const seed = hashString(`ccat:${roundKeyRef.current}:${kind}`);
        const item = buildFor(kind, seed, { pool, meta, target, lvl });
        if (item) {
          built = item;
          usedKind = kind;
        }
      }
      roundKeyRef.current += 1;

      if (!built) {
        setNoContent(true);
        setScreen('summary');
        recordGameResult('ccat', correctCount).then((r) => setBest(r.best));
        return;
      }

      const rd = toRenderData(usedKind, built, pl, lvl, target, source);
      setRender(rd);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [correctCount, startClock, contentLang]
  );

  useLoadOnMount(load);

  useEffect(() => {
    return () => stopClock();
  }, []);

  // GAMES.md 4.10 loop: "Indul" -> 3-2-1 -> questions, with the run clock
  // ticking down at the top. Time out = the run ends where it stands, exactly
  // as the real test does; there is no going back to a skipped question.
  const beginRun = useCallback(() => {
    load().then(({ pool, meta, mix, pl, tl, lvl, target, source, count }) => {
      if (pool.length === 0) {
        setNoContent(true);
        setScreen('summary');
        return;
      }
      setTimeUp(false);
      setScreen('playing');
      buildNextRound(pool, meta, mix, pl, tl, lvl, target, source);
      if (tl !== 'none') {
        const budget = count * EXAM_SECONDS_PER_QUESTION;
        setRunSeconds(budget);
        startClock(budget, () => {
          setTimeUp(true);
          setScreen('summary');
          recordGameResult('ccat', correctCountRef.current).then((r) => setBest(r.best));
        });
      } else {
        setRunSeconds(0);
        setClock(null);
      }
    });
  }, [buildNextRound, load, startClock]);

  const recordTally = (kind: CcatItemKind, correct: boolean) => {
    setTally((prev) => {
      const cur = prev[kind] ?? { correct: 0, total: 0 };
      return { ...prev, [kind]: { correct: cur.correct + (correct ? 1 : 0), total: cur.total + 1 } };
    });
  };

  const selectOption = (i: number) => {
    if (answered || !render) return;
    stopClock();
    setSelected(i);
    setAnswered(true);
    const correct = i === render.correctIndex;
    if (correct) {
      correctCountRef.current += 1;
      setCorrectCount((c) => c + 1);
    }
    recordTally(render.kind, correct);
    if (!correct) setReviewList((prev) => [...prev, { kind: render.kind, promptText: render.promptText, explanation: render.explanation }]);
    if (render.wordId) getDb().recordAttempt(render.wordId, 'game:ccat', correct, 0).catch(() => {});
  };

  const next = () => {
    if (index + 1 >= questionCount) {
      stopClock();
      recordGameResult('ccat', correctCount).then((r) => setBest(r.best));
      setScreen('summary');
      return;
    }
    setIndex((i) => i + 1);
    buildNextRound(poolEntries, oddMeta, typeMix, promptLangSetting, timeLimit, level, learnedLang, nativeLang);
  };

  const saveSettings = (next2: { questionCount: number; timeLimit: TimeLimit; typeMix: TypeMix; promptLang: PromptLangSetting }) => {
    getDb().setGameSettings('ccat', next2).catch(() => {});
  };

  const restart = () => {
    stopClock();
    setScreen('start');
    setCountingIn(false);
  };

  const settingsFields: SettingField[] = [
    {
      key: 'questionCount',
      type: 'select',
      label: s.games.ccat.questionCountLabel,
      options: QUESTION_COUNTS.map((n) => ({ value: String(n), label: String(n) })),
    },
    {
      key: 'timeLimit',
      type: 'select',
      label: s.games.ccat.timeLimitLabel,
      options: [
        { value: 'none', label: s.games.ccat.timeLimitNone },
        { value: 'exam', label: s.games.ccat.timeLimitExam },
      ],
    },
    {
      key: 'typeMix',
      type: 'select',
      label: s.games.ccat.typeMixLabel,
      options: [
        { value: 'all', label: s.games.ccat.typeMixAll },
        { value: 'verbal', label: s.games.ccat.typeMixVerbal },
        { value: 'logic', label: s.games.ccat.typeMixLogic },
      ],
    },
    {
      key: 'promptLang',
      type: 'select',
      label: s.games.ccat.promptLangLabel,
      options: [
        { value: 'learned', label: s.games.ccat.promptLangLearned },
        { value: 'native', label: s.games.ccat.promptLangNative },
      ],
    },
  ];

  const handleSettingsChange = (key: string, value: string | number | boolean) => {
    if (key === 'questionCount') {
      const n = Number(value);
      setQuestionCount(n);
      saveSettings({ questionCount: n, timeLimit, typeMix, promptLang: promptLangSetting });
    } else if (key === 'timeLimit') {
      const v = value as TimeLimit;
      setTimeLimit(v);
      saveSettings({ questionCount, timeLimit: v, typeMix, promptLang: promptLangSetting });
    } else if (key === 'typeMix') {
      const v = value as TypeMix;
      setTypeMix(v);
      kindQueueRef.current = [];
      saveSettings({ questionCount, timeLimit, typeMix: v, promptLang: promptLangSetting });
    } else if (key === 'promptLang') {
      const v = value as PromptLangSetting;
      setPromptLangSetting(v);
      saveSettings({ questionCount, timeLimit, typeMix, promptLang: v });
    }
  };

  // The reliable "how many questions were actually presented" count: index
  // alone is ambiguous at an early noContent stop (it may or may not have
  // advanced past the last successfully-answered question), the tally
  // (updated on every real answer/timeout) is not.
  const totalAnswered = Object.values(tally).reduce((sum, v) => sum + (v?.total ?? 0), 0);

  if (screen === 'start') {
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
        <View style={styles.startBody}>
          <Text style={styles.startEmoji}>{gameDef.icon}</Text>
          <Text style={[styles.startIntro, { color: colors.text }]}>
            {s.games.ccat.startIntro(questionCount, Math.round((questionCount * EXAM_SECONDS_PER_QUESTION) / 60))}
          </Text>
          <Text style={[styles.cardSub, { color: colors.tabIconDefault }]}>
            {timeLimit === 'none' ? s.games.ccat.startUntimed : s.games.ccat.startTimed}
          </Text>
          <Text style={[styles.cardSub, { color: colors.tabIconDefault }]}>
            {s.games.best}: {best}
          </Text>
          <Pressable
            testID="ccat-start"
            style={[styles.btn, { backgroundColor: colors.tint }]}
            onPress={() => setCountingIn(true)}
          >
            <Text style={styles.btnText}>{s.games.go}</Text>
          </Pressable>
        </View>

        {countingIn ? (
          <CountdownStart
            onDone={() => {
              setCountingIn(false);
              beginRun();
            }}
          />
        ) : null}

        <GameSettingsSheet
          visible={settingsOpen}
          title={s.games.settings}
          fields={settingsFields}
          values={{ questionCount: String(questionCount), timeLimit, typeMix, promptLang: promptLangSetting }}
          onChange={handleSettingsChange}
          onClose={() => setSettingsOpen(false)}
        />
      </View>
    );
  }

  if (screen === 'summary') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.summaryBody}>
          <Text style={[styles.summaryTitle, { color: colors.text }]}>{s.games.summaryTitle}</Text>
          {noContent && totalAnswered === 0 ? (
            <Text style={[styles.emptyText, { color: colors.tabIconDefault }]}>{s.games.ccat.notEnoughContent}</Text>
          ) : (
            <>
              {timeUp ? <Text style={[styles.cardSub, { color: '#EF4444' }]}>{s.games.ccat.timeUp}</Text> : null}
              <Text style={[styles.summaryScore, { color: colors.tint }]}>{s.games.summaryScore(correctCount, totalAnswered)}</Text>
              <Text style={[styles.cardSub, { color: colors.tabIconDefault }]}>
                {s.games.best}: {best}
              </Text>

              <Text style={[styles.sectionHeader, { color: colors.text }]}>{s.games.ccat.typeBreakdownHeader}</Text>
              {Object.entries(tally).map(([kind, v]) => (
                <View key={kind} style={styles.breakdownRow}>
                  <Text style={[styles.breakdownLabel, { color: colors.text }]}>{s.games.ccat.typeLabels[kind as CcatItemKind]}</Text>
                  <Text style={[styles.breakdownScore, { color: colors.tabIconDefault }]}>
                    {v!.correct}/{v!.total}
                  </Text>
                </View>
              ))}

              {reviewList.length > 0 ? (
                <>
                  <Text style={[styles.sectionHeader, { color: colors.text }]}>{s.games.ccat.reviewHeader}</Text>
                  {reviewList.map((r, i) => (
                    <View key={i} style={[styles.reviewCard, { backgroundColor: colors.card }]}>
                      <Text style={[styles.reviewType, { color: colors.tint }]}>{s.games.ccat.typeLabels[r.kind]}</Text>
                      <Text style={[styles.reviewPrompt, { color: colors.text }]}>{r.promptText}</Text>
                      <Text style={[styles.reviewExplain, { color: colors.tabIconDefault }]}>{r.explanation}</Text>
                    </View>
                  ))}
                </>
              ) : null}
            </>
          )}

          <View style={styles.summaryButtons}>
            <Pressable style={[styles.btn, styles.btnGhost, styles.summaryBtn, { borderColor: colors.tint }]} onPress={() => router.back()}>
              <Text style={[styles.btnGhostText, { color: colors.tint }]}>{s.games.backToHub}</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.summaryBtn, { backgroundColor: colors.tint }]} onPress={restart}>
              <Text style={styles.btnText}>{s.games.playAgain}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (!render) {
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
          <Text style={[styles.progress, { color: colors.tabIconDefault }]}>{s.games.ccat.progress(index + 1, questionCount)}</Text>
          {clock !== null ? (
            <Text testID="ccat-clock" style={[styles.progress, { color: colors.tint }]}>
              ⏱ {Math.floor(clock / 60)}:{String(clock % 60).padStart(2, '0')}
            </Text>
          ) : null}
        </View>
        {clock !== null && runSeconds > 0 ? (
          <View style={[styles.timeBarTrack, { backgroundColor: colors.card }]}>
            <View
              testID="ccat-time-bar"
              style={[styles.timeBarFill, { backgroundColor: colors.tint, width: `${Math.max(0, Math.min(100, (clock / runSeconds) * 100))}%` }]}
            />
          </View>
        ) : null}

        {render.promptLabel ? <Text style={[styles.promptLabel, { color: colors.tabIconDefault }]}>{render.promptLabel}</Text> : null}
        <Text style={[styles.prompt, { color: colors.text }]}>{render.promptText}</Text>

        <View style={styles.grid}>
          {render.options.map((opt, i) => {
            const isCorrect = i === render.correctIndex;
            const isPicked = selected === i;
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
                key={`${opt}-${i}`}
                testID="ccat-option"
                style={[styles.tile, { backgroundColor: bg, borderColor: border }]}
                onPress={() => selectOption(i)}
                disabled={answered}
              >
                <Text style={[styles.tileText, { color: colors.text }]} numberOfLines={2}>
                  {opt}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {answered ? (
          <View style={[styles.explainCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.explainHeader, { color: selected === render.correctIndex ? '#22C55E' : '#EF4444' }]}>
              {selected === render.correctIndex ? s.games.correctFeedback : s.games.wrongFeedback}
            </Text>
            <Text style={[styles.explainText, { color: colors.text }]}>{render.explanation}</Text>
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
        values={{ questionCount, timeLimit, typeMix, promptLang: promptLangSetting }}
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
  startBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  startEmoji: { fontSize: 56 },
  startIntro: { fontSize: 16, textAlign: 'center', lineHeight: 22 },
  timeBarTrack: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 10 },
  timeBarFill: { height: 6, borderRadius: 3 },
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
  promptLabel: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  prompt: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
  },
  tile: {
    minWidth: '28%',
    minHeight: 60,
    borderWidth: 2,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tileText: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  explainCard: { borderRadius: 16, padding: 16, gap: 8, width: '100%' },
  explainHeader: { fontSize: 16, fontWeight: '700' },
  explainText: { fontSize: 14, lineHeight: 20 },
  btn: { paddingVertical: 14, borderRadius: 24, alignItems: 'center' },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1 },
  btnGhostText: { fontWeight: '600' },
  btnText: { color: '#FFFFFF', fontWeight: '700' },
  cardSub: { fontSize: 13, textAlign: 'center' },
  summaryBody: { padding: 20, gap: 12, alignItems: 'center' },
  summaryTitle: { fontSize: 28, fontWeight: '800' },
  summaryScore: { fontSize: 22, fontWeight: '700' },
  summaryButtons: { flexDirection: 'row', gap: 12, marginTop: 12 },
  // Kálmán 2026-09-09: a két gomb egyenlő széles, ne a felirat hossza döntse el.
  summaryBtn: { flex: 1 },
  emptyText: { fontSize: 15, textAlign: 'center' },
  sectionHeader: { fontSize: 16, fontWeight: '700', alignSelf: 'flex-start', marginTop: 12 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingVertical: 4 },
  breakdownLabel: { fontSize: 14 },
  breakdownScore: { fontSize: 14, fontWeight: '600' },
  reviewCard: { borderRadius: 14, padding: 12, gap: 4, width: '100%' },
  reviewType: { fontSize: 12, fontWeight: '700' },
  reviewPrompt: { fontSize: 14, fontWeight: '600' },
  reviewExplain: { fontSize: 13 },
});
