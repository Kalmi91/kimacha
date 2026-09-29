import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import { getDb } from '@/lib/database';
import { normalizeWordToken, type Level } from '@/data/words';
import { cumulativeCorpusWordIds, grammarKindCounts, isLessonV2, type GrammarGapItem, type GrammarItem, type GrammarKind, type GrammarTopicData } from '@/lib/games/content';
import { buildGlossMap } from '@/lib/games/gloss';
import { GRAMMAR_PROGRESS_KEY, lessonFor, nextWrittenTopic, syllabusTopic } from '@/lib/grammar/syllabus';
import { lessonPercent } from '@/lib/grammar/lessonScore';
import { tableCellsForLesson, wordCellsForLesson, WORD_DECK_MIN_CARDS } from '@/lib/grammar/tableDeck';
import { TRANSFORM_ROUND_SIZE } from '@/lib/grammar/transformRounds';
import { getScrollY, setScrollY } from '@/lib/grammar/scrollMemory';
import { speak, speakSequence, stopSpeaking } from '@/lib/speech';
import { splitByLanguage, splitByMarkers } from '@/lib/mixedSpeech';
import { speechLang } from '@/lib/languages';
import GlossText from '@/components/games/GlossText';
import GrammarDrill, { type RoundStats } from '@/components/grammar/GrammarDrill';
import LessonBody from '@/components/grammar/LessonBody';
import MoreBlocks from '@/components/grammar/MoreBlocks';
import FeedbackButton from '@/components/FeedbackModal';
import { BrutalBox, Card, SegmentBar, Sticker, segmentsFilled } from '@/components/grammar/Brutal';
import { useLoadOnMount } from '@/lib/useLoadOnMount';

// One grammar lesson: the rule first, then the practice.
//
// The lesson READS (rule, the exceptions block, worked examples you can tap for
// meaning and hear spoken), and only then drills, because the Game tab's
// grammar-choice already covers "drill first, explanation after" and the point
// of the course is the other order: understand, then check.

type Phase = 'lesson' | 'drill' | 'done';

// D3 (FB290, 2026-09-17): a gombok ebben a sorrendben jelennek meg, csak azok
// a fajták, amikből van item a leckében.
const KIND_ORDER: GrammarKind[] = ['choice', 'match', 'form', 'why', 'transform'];

export default function GrammarLessonScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t();
  const router = useRouter();
  const { topic: topicId } = useLocalSearchParams<{ topic: string }>();

  const [learnedLang, setLearnedLang] = useState('es');
  const [contentLang, setContentLang] = useState('en');
  const [level, setLevel] = useState<Level>('A1');
  const [lesson, setLesson] = useState<GrammarTopicData | null>(null);
  const [phase, setPhase] = useState<Phase>('lesson');
  const [score, setScore] = useState<{ correct: number; total: number } | null>(null);
  // D3 (FB290): melyik fajtát indította el a tanuló (a gombja szerint), ez megy
  // a GrammarDrill `kinds` propjába és a haladás-sor kulcsába is.
  const [drillKind, setDrillKind] = useState<GrammarKind>('choice');
  // FB340-342/345/356: a látható drill-item id-ja, a feedback-kontextusba.
  const [drillItemId, setDrillItemId] = useState<string | undefined>(undefined);
  // FB327: a lecke-body ScrollView fázisváltáskor újra-mountol, a pozíciót a
  // lib/grammar/scrollMemory.ts tartja topicId szerint, hogy visszaállítható legyen.
  const scrollRef = useRef<ScrollView>(null);
  // LECKE-SEMA 3.3: a V2 lecke egyetlen (play → stop) gombja a lesson.speak
  // felolvasásához; leállítás gombnyomásra, fázisváltáskor és unmountkor is.
  const [speaking, setSpeaking] = useState(false);
  // FB316 (NY10): hányszor gyakorolt már egy-egy transform item (itemId -> n),
  // ez dönti el a következő 10-es kör sorrendjét (legkevésbé gyakorolt elöl).
  const [transformSeen, setTransformSeen] = useState<Record<string, number>>({});
  // FB328: a lecke ÖSSZES eddigi köréből (bármelyik fajta) számolt kumulált
  // megválaszolt/helyes darabszám, a Kész-képernyő "Eddig: NN%" sorához.
  const [lessonAnswered, setLessonAnswered] = useState(0);
  const [lessonCorrect, setLessonCorrect] = useState(0);
  // FB380: ugyanaz a kumulált megválaszolt/helyes pár, fajtánként külön
  // (`${topic}:${kind}:answered`/`:correct`), hogy a lecke-képernyőn minden
  // feladat gomb mellett a SAJÁT %-a is látsszon, ugyanazzal a lessonPercent
  // logikával, ami a kinti (Kész-képernyős) számot adja. A kinti szám ezek
  // fajtánkénti darabszámainak összege, nem külön számított.
  const [kindAnswered, setKindAnswered] = useState<Partial<Record<GrammarKind, number>>>({});
  const [kindCorrect, setKindCorrect] = useState<Partial<Record<GrammarKind, number>>>({});
  // NY24: a kör-vége képernyő adatai (csak memóriában): a drill statisztikája, a
  // kör ELŐTTI kumulált %, és a streak-nap.
  const [roundStats, setRoundStats] = useState<RoundStats | null>(null);
  const [prevPct, setPrevPct] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);

  const load = useCallback(async () => {
    const db = getDb();
    const onboarding = await db.getOnboarding();
    const target = onboarding?.target ?? 'es';
    setLearnedLang(target);
    // Kimacha Play: UI always English (Kálmán, 2026-09-22), regardless of the
    // stored source language; the lesson data's hu/es/de fields stay unused.
    // es→en (Kálmán, 2026-09-28): a spanyol anyanyelvű tanuló spanyol magyarázatot kap.
    setContentLang(target === 'en' ? 'es' : 'en');
    const levelData = await db.getLevel();
    setLevel((levelData.level as Level) ?? 'A1');
    setStreak((await db.getStreak())?.current_count ?? 0);
    const loadedLesson = lessonFor(target, String(topicId)) ?? null;
    setLesson(loadedLesson);
    if (loadedLesson) {
      // FB316 (NY10): a kör indítása előtt betöltjük, melyik transform item
      // hányszor gyakorolt, hogy a legkevésbé gyakorolt kerülhessen elöre.
      const progressRows = await db.getGameProgress(GRAMMAR_PROGRESS_KEY);
      const seenRow = progressRows.find((r) => r.itemId === `${String(topicId)}:transform:seen`);
      setTransformSeen((seenRow?.data as Record<string, number>) ?? {});
      // FB328: ugyanabból a lekérésből, külön sor nélkül.
      const answeredRow = progressRows.find((r) => r.itemId === `${String(topicId)}:answered`);
      const correctRow = progressRows.find((r) => r.itemId === `${String(topicId)}:correct`);
      setLessonAnswered(typeof answeredRow?.data === 'number' ? answeredRow.data : 0);
      setLessonCorrect(typeof correctRow?.data === 'number' ? correctRow.data : 0);
      // FB380: ugyanabból a lekérésből, fajtánként.
      const nextKindAnswered: Partial<Record<GrammarKind, number>> = {};
      const nextKindCorrect: Partial<Record<GrammarKind, number>> = {};
      for (const kind of KIND_ORDER) {
        const kA = progressRows.find((r) => r.itemId === `${String(topicId)}:${kind}:answered`);
        const kC = progressRows.find((r) => r.itemId === `${String(topicId)}:${kind}:correct`);
        if (typeof kA?.data === 'number') nextKindAnswered[kind] = kA.data;
        if (typeof kC?.data === 'number') nextKindCorrect[kind] = kC.data;
      }
      setKindAnswered(nextKindAnswered);
      setKindCorrect(nextKindCorrect);
    } else {
      setTransformSeen({});
      setLessonAnswered(0);
      setLessonCorrect(0);
      setKindAnswered({});
      setKindCorrect({});
    }
  }, [topicId]);

  useLoadOnMount(load);

  // LECKE-SEMA 3.3: felolvasás-leállítás fázisváltáskor és unmountkor is,
  // nem csak a gomb megnyomására. Hook-szabály miatt a `lesson`-null korai
  // return ELŐTT kell állnia.
  useEffect(() => {
    if (phase !== 'lesson') return;
    return () => {
      stopSpeaking();
      setSpeaking(false);
    };
  }, [phase]);

  const entry = syllabusTopic(String(topicId), learnedLang);

  if (!lesson) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={[styles.back, { color: colors.text }]}>←</Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {entry?.title[contentLang] ?? String(topicId)}
          </Text>
          <View style={{ width: 24 }} />
        </View>
        <Text style={[styles.empty, { color: colors.tabIconDefault }]}>{s.grammar.soonLong}</Text>
      </View>
    );
  }

  // LECKE-SEMA: title mindkét sémában Record<hu/en/es/de,string>-szerű, de a
  // LessonV2 Lang4-je nem enged tetszőleges string-indexet, innen a cast.
  const lessonTitle = (lesson.title as Record<string, string>)[contentLang] ?? lesson.title.en;
  const knownIds = cumulativeCorpusWordIds(lesson.level, learnedLang);
  const overrides = Object.fromEntries((lesson.glossary ?? []).map((g) => [normalizeWordToken(g.word), g.gloss]));
  // D3 (FB290): csak azokra a fajtákra jön gomb, amikből van item a leckében
  // (pl. hay-estar nem kap ragozás-gombot, mert nincs benne form item).
  const kindCounts = grammarKindCounts(lesson);
  const availableKinds = KIND_ORDER.filter((k) => kindCounts[k] > 0);
  // PLAN-play 13. lépés (s6): the deck button only where the lesson actually
  // has a conjugation table (lib/grammar/tableDeck.ts already excludes the
  // reference GridTables and vosotros rows).
  const tableDeckCells = tableCellsForLesson(lesson);
  // FB375 (PLAN-fb0923 6. lépés, D5/a): a table-less lesson gets a word-deck
  // instead, built from its own vocabulary; only shown at >= 8 cards, and
  // never alongside the table-deck button (D5: "ne legyen két gomb").
  const wordDeckCells = tableDeckCells.length === 0 ? wordCellsForLesson(lesson) : [];

  // Two worked examples from the first items, so the lesson SHOWS the rule
  // before it asks anything.
  // FB219: a jelölős feladat mondata már kész, nincs mit behelyettesíteni, így a
  // bemutató példák a lyukas tételekből jönnek.
  // LECKE-SEMA: uniós lecke-alak miatt a `.filter` narrowing csak egy lapos
  // `GrammarItem[]` castra épülve szűkít helyesen rule/more-hoz hasonlóan.
  // LECKE-SEMA 2: a LessonV2 items tömbje match/form tételeket is tartalmaz,
  // azoknak nincs `sentence`/`options` mezőjük, tehát itt kifejezetten a
  // (kind hiányzó vagy 'gap') tételekre kell szűkíteni, nem csak a mark-ot
  // kizárni.
  const worked = (lesson.items as GrammarItem[])
    .filter((item): item is GrammarGapItem => item.kind === undefined || item.kind === 'gap')
    .slice(0, 3)
    .map((item) => ({
      filled: item.sentence.replace('___', item.options[item.correct]),
      why: item.why[contentLang] ?? item.why.en,
    }));

  // LECKE-SEMA: LessonV2-nek nincs rule/more mezője; a body-blokkok
  // megjelenítése step 3, itt csak annyi kell, hogy a régi séma tovább
  // fusson és a fordító ne akadjon fenn az únión.
  const ruleText = 'rule' in lesson ? lesson.rule[contentLang] ?? lesson.rule.en : '';

  // FB216: nyelv-szakaszokra vágva olvassuk fel, hogy a spanyol példa spanyolul
  // szóljon a magyar/angol magyarázat közepén is.
  const readAloud = (text: string) =>
    speakSequence(
      splitByLanguage(text, { learnedLang, nativeLang: contentLang }).map((seg) => ({
        text: seg.text,
        locale: speechLang(seg.lang),
      }))
    );

  // LECKE-SEMA 3: a V2 lecke `speak` mezőjét a «...»-jelölés vágja szakaszokra
  // (nem korpusz-találgatás), és a gomb play<->stop kapcsoló (LECKE-SEMA 3.3).
  const toggleLessonSpeech = () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    if (!isLessonV2(lesson)) return;
    const text = lesson.speak[contentLang as 'hu' | 'en' | 'es' | 'de'] ?? lesson.speak.en;
    const segments = splitByMarkers(text, { learnedLang, nativeLang: contentLang }).map((seg) => ({
      text: seg.text,
      locale: speechLang(seg.lang),
    }));
    setSpeaking(true);
    speakSequence(segments, () => setSpeaking(false));
  };

  const finish = async (correct: number, total: number, roundItemIds?: string[]) => {
    setPrevPct(lessonPercent(lessonAnswered, lessonCorrect));
    setScore({ correct, total });
    setPhase('done');
    // D3 (FB290): a sor kulcsa fajtánként külön (`${topic}:${kind}`), és csak
    // akkor íródik, ha ez a fajta ezúttal >=80%-ra ment (lásd
    // doneGrammarTopicProgress: egy fajta csak így számít késznek).
    const pct = total ? Math.round((correct / total) * 100) : 0;
    if (pct >= 80) {
      getDb()
        .setGameProgress(GRAMMAR_PROGRESS_KEY, `${String(topicId)}:${drillKind}`, 'done', { correct, total })
        .catch(() => {});
    }
    // FB328: kumulált megválaszolt/helyes darabszám, MINDEN fajta MINDEN
    // körénél, a meglévő >=80%-os "kész" küszöbtől függetlenül.
    const nextAnswered = lessonAnswered + total;
    const nextCorrect = lessonCorrect + correct;
    setLessonAnswered(nextAnswered);
    setLessonCorrect(nextCorrect);
    getDb().setGameProgress(GRAMMAR_PROGRESS_KEY, `${String(topicId)}:answered`, 'count', nextAnswered).catch(() => {});
    getDb().setGameProgress(GRAMMAR_PROGRESS_KEY, `${String(topicId)}:correct`, 'count', nextCorrect).catch(() => {});
    // FB380: ugyanaz a kumulálás, fajtánként külön is, hogy a lecke-képernyőn
    // minden feladat gomb mellett a saját %-a is látsszon (a kinti szám ezek
    // összege: lessonAnswered/lessonCorrect fentebb pontosan ennyi minden
    // körnél, tehát a kinti szám mindig a fajtánkénti részek súlyozott
    // összege marad, nincs külön súlyozó logika).
    const nextKindAnswered = (kindAnswered[drillKind] ?? 0) + total;
    const nextKindCorrect = (kindCorrect[drillKind] ?? 0) + correct;
    setKindAnswered((prev) => ({ ...prev, [drillKind]: nextKindAnswered }));
    setKindCorrect((prev) => ({ ...prev, [drillKind]: nextKindCorrect }));
    getDb().setGameProgress(GRAMMAR_PROGRESS_KEY, `${String(topicId)}:${drillKind}:answered`, 'count', nextKindAnswered).catch(() => {});
    getDb().setGameProgress(GRAMMAR_PROGRESS_KEY, `${String(topicId)}:${drillKind}:correct`, 'count', nextKindCorrect).catch(() => {});
    // FB316 (NY10): a kör itemjei "gyakoroltak" lesznek, jó és rossz válasz is
    // számít; egy írás a kör végén, nem itemenként.
    if (drillKind === 'transform' && roundItemIds && roundItemIds.length) {
      const updated = { ...transformSeen };
      for (const id of roundItemIds) updated[id] = (updated[id] ?? 0) + 1;
      setTransformSeen(updated);
      getDb()
        .setGameProgress(GRAMMAR_PROGRESS_KEY, `${String(topicId)}:transform:seen`, 'seen', updated)
        .catch(() => {});
    }
  };

  // NY23: brutalista palettán a vissza-gomb dobozban, a cím nagybetűs, a szint matrica.
  const header = g.brutal ? (
    <View style={styles.header}>
      <BrutalBox
        testID="grammar-back"
        boxStyle={styles.brutalBack}
        onPress={() => (phase === 'lesson' ? router.back() : setPhase('lesson'))}
      >
        <Text style={[styles.back, { color: g.ink }]}>←</Text>
      </BrutalBox>
      <Text style={[styles.title, styles.brutalTitle, { color: g.ink }]} numberOfLines={1}>
        {lessonTitle}
      </Text>
      <Sticker label={lesson.level} fill="a" rotate={5} />
    </View>
  ) : (
    <View style={styles.header}>
      <Pressable onPress={() => (phase === 'lesson' ? router.back() : setPhase('lesson'))} hitSlop={12}>
        <Text style={[styles.back, { color: colors.text }]}>←</Text>
      </Pressable>
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
        {lessonTitle}
      </Text>
      <Text style={[styles.levelTag, { color: colors.tint }]}>{lesson.level}</Text>
    </View>
  );
  // NY23: a cím-szín brutalista palettán ink (a kitöltő a / b szín papíron nem olvasható szöveg).
  const accentText = g.brutal ? g.ink : colors.tint;

  // NY23: fő gomb: brutalista palettán a kitöltésű doboz, classic-on a mai gomb.
  const lessonButton = (testID: string, label: string, onPress: () => void, filled: boolean, first: boolean) =>
    g.brutal ? (
      <BrutalBox
        testID={testID}
        fill={filled ? 'a' : 'paper'}
        style={[styles.brutalBtnWrap, first && styles.startBtn]}
        boxStyle={styles.brutalBtn}
        onPress={onPress}
      >
        <Text style={[styles.brutalBtnText, { color: filled ? g.onFill : g.ink }]}>{label}</Text>
      </BrutalBox>
    ) : (
      <Pressable
        testID={testID}
        style={[
          styles.btn,
          first && styles.startBtn,
          filled ? { backgroundColor: colors.tint } : { borderWidth: 1.5, borderColor: colors.tint },
        ]}
        onPress={onPress}
      >
        <Text style={[styles.btnText, filled ? styles.btnTextOnTint : { color: colors.tint }]}>{label}</Text>
      </Pressable>
    );

  if (phase === 'drill') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* NY22: brutalista palettán a drill saját fejléce (X + szegmentált sáv + combo) váltja. */}
        {g.brutal ? null : header}
        {/* LECKE-SEMA 2/6.3/D3: a lecke-drill a `drillKind` fajtáját viszi végig
            (a gombok fajtánként külön indítanak), a Game fül grammar-choice-a
            a `kinds` prop híján változatlanul csak a gap/mark körét kapja. */}
        <GrammarDrill
          topic={lesson}
          learnedLang={learnedLang}
          contentLang={contentLang}
          onFinish={finish}
          kinds={[drillKind]}
          transformSeen={transformSeen}
          onItemChange={setDrillItemId}
          onRoundStats={setRoundStats}
          onClose={() => setPhase('lesson')}
        />
        <FeedbackButton
          level={level}
          languagePair={`${contentLang}→${learnedLang}`}
          currentCard={`grammar:${topicId}:drill${drillItemId ? `:${drillItemId}` : ''}`}
        />
      </View>
    );
  }

  if (phase === 'done' && score) {
    const pct = score.total ? Math.round((score.correct / score.total) * 100) : 0;
    // Kálmán 2026-09-09: a Kész-képernyőről tovább lehessen lépni a következő
    // témára. Csak megírt leckére kínáljuk fel, üres képernyőre nem viszünk.
    const next = nextWrittenTopic(learnedLang, String(topicId));
    // FB328: a lecke MINDEN eddigi köréből számolt kumulált arány, nem csak
    // ennek a körnek a pontszáma (ami fentebb, `pct`).
    const cumulativePct = lessonPercent(lessonAnswered, lessonCorrect);
    // NY24 (neo-brutalista, NYELVTAN.md "Neo-brutalista stílus" 3. képernyő): nagy
    // helyes-arány a kitöltött dobozban + combo-matrica, 3 kis doboz, "practice
    // this" a rontott mondattal, téma-progress szegmensekben, gombok.
    if (g.brutal) {
      const secs = roundStats?.seconds ?? 0;
      const time = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
      const miss = roundStats?.miss ?? null;
      const missAt = miss ? miss.sentence.indexOf(miss.highlight) : -1;
      const stat = (label: string, value: string, fill: 'paper' | 'b') => (
        <BrutalBox fill={fill} style={styles.brutalStatWrap} boxStyle={styles.brutalStat}>
          <Text style={[styles.brutalStatValue, { color: fill === 'b' ? g.onFill : g.ink }]}>{value}</Text>
          <Text style={[styles.brutalStatLabel, { color: fill === 'b' ? g.onFill : g.mu }]}>{label}</Text>
        </BrutalBox>
      );
      return (
        <View style={[styles.container, { backgroundColor: g.bg }]}>
          {header}
          <ScrollView contentContainerStyle={styles.brutalDoneBody}>
            <BrutalBox testID="grammar-score" fill="a" boxStyle={styles.brutalScoreBox}>
              <Text style={[styles.brutalScore, { color: g.onFill }]}>
                {score.correct}/{score.total}
              </Text>
              <Text style={[styles.brutalNote, { color: g.onFill }]}>{pct >= 80 ? s.grammar.doneGood : s.grammar.doneAgain}</Text>
              {roundStats && roundStats.bestCombo >= 2 ? (
                <View style={styles.brutalComboPos}>
                  <Sticker testID="grammar-best-combo" label={s.grammar.comboLabel(roundStats.bestCombo)} fill="b" rotate={6} />
                </View>
              ) : null}
            </BrutalBox>

            <View style={styles.brutalStats}>
              {stat(s.grammar.statCorrect, String(score.correct), 'paper')}
              {stat(s.grammar.statTime, time, 'paper')}
              {stat(s.grammar.statStreak, `🔥 ${streak}`, 'b')}
            </View>

            {cumulativePct !== null ? (
              <BrutalBox boxStyle={styles.brutalProgressBox}>
                <SegmentBar segments={8} filled={segmentsFilled(cumulativePct, 8)} />
                <Text style={[styles.brutalStatLabel, { color: g.ink }]}>{s.grammar.progressChange(prevPct, cumulativePct)}</Text>
                <Text testID="grammar-lesson-percent" style={[styles.brutalStatLabel, { color: g.mu }]}>
                  {s.grammar.lessonPercent(cumulativePct)}
                </Text>
              </BrutalBox>
            ) : null}

            {miss ? (
              <BrutalBox testID="grammar-practice-this" boxStyle={styles.brutalProgressBox}>
                <Text style={[styles.brutalStatLabel, { color: g.mu }]}>{s.grammar.practiceThis}</Text>
                <Text style={[styles.brutalMiss, { color: g.ink }]}>
                  {missAt >= 0 ? miss.sentence.slice(0, missAt) : miss.sentence}
                  {missAt >= 0 ? (
                    <Text style={{ backgroundColor: g.b, color: g.onFill }}>{miss.highlight}</Text>
                  ) : null}
                  {missAt >= 0 ? miss.sentence.slice(missAt + miss.highlight.length) : ''}
                </Text>
              </BrutalBox>
            ) : null}

            {next ? (
              <BrutalBox
                testID="grammar-next-topic"
                fill="a"
                style={styles.brutalBtnWrap}
                boxStyle={styles.brutalBtn}
                onPress={() => router.replace(`/grammar/${next.id}` as never)}
              >
                <Text style={[styles.brutalBtnText, { color: g.onFill }]}>{s.grammar.nextTopic} →</Text>
              </BrutalBox>
            ) : null}
            <BrutalBox style={styles.brutalBtnWrap} boxStyle={styles.brutalBtn} onPress={() => setPhase('lesson')}>
              <Text style={[styles.brutalBtnText, { color: g.ink }]}>{s.grammar.backToRule}</Text>
            </BrutalBox>
            {drillKind === 'transform' && kindCounts.transform > TRANSFORM_ROUND_SIZE ? (
              <BrutalBox
                testID="grammar-more-round"
                fill="a"
                style={styles.brutalBtnWrap}
                boxStyle={styles.brutalBtn}
                onPress={() => {
                  setScore(null);
                  setPhase('drill');
                }}
              >
                <Text style={[styles.brutalBtnText, { color: g.onFill }]}>{s.grammar.moreRound(TRANSFORM_ROUND_SIZE)}</Text>
              </BrutalBox>
            ) : null}
            <Pressable
              testID="grammar-practice-again"
              style={styles.ghostBtn}
              onPress={() => {
                setScore(null);
                setPhase('drill');
              }}
            >
              <Text style={[styles.brutalUnderline, { color: g.ink }]}>{s.grammar.oneMoreRound}</Text>
            </Pressable>
            <Pressable style={styles.ghostBtn} onPress={() => router.back()}>
              <Text style={[styles.ghostBtnText, { color: g.mu }]}>{s.grammar.backToSyllabus}</Text>
            </Pressable>
          </ScrollView>
        </View>
      );
    }
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {header}
        <View style={styles.doneBody}>
          <Text style={styles.doneEmoji}>{pct >= 80 ? '🎉' : '📘'}</Text>
          <Text style={[styles.doneScore, { color: colors.text }]}>
            {score.correct} / {score.total}
          </Text>
          <Text style={[styles.doneNote, { color: colors.tabIconDefault }]}>
            {pct >= 80 ? s.grammar.doneGood : s.grammar.doneAgain}
          </Text>
          {cumulativePct !== null ? (
            <Text testID="grammar-lesson-percent" style={[styles.lessonPercentNote, { color: colors.tabIconDefault }]}>
              {s.grammar.lessonPercent(cumulativePct)}
            </Text>
          ) : null}
          {next ? (
            <Pressable
              testID="grammar-next-topic"
              style={[
                styles.btn,
                pct >= 80 ? { backgroundColor: colors.tint } : { borderWidth: 1.5, borderColor: colors.tint },
              ]}
              onPress={() => router.replace(`/grammar/${next.id}` as never)}
            >
              <Text style={[styles.btnText, pct >= 80 ? styles.btnTextOnTint : { color: colors.tint }]}>
                {s.grammar.nextTopic}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            style={[
              styles.btn,
              pct >= 80 && next ? { borderWidth: 1.5, borderColor: colors.tint } : { backgroundColor: colors.tint },
            ]}
            onPress={() => setPhase('lesson')}
          >
            <Text
              style={[
                styles.btnText,
                pct >= 80 && next ? { color: colors.tint } : styles.btnTextOnTint,
              ]}
            >
              {s.grammar.backToRule}
            </Text>
          </Pressable>
          <Pressable
            testID="grammar-practice-again"
            style={[styles.btn, { borderWidth: 1.5, borderColor: colors.tint }]}
            onPress={() => {
              setScore(null);
              setPhase('drill');
            }}
          >
            <Text style={[styles.btnText, { color: colors.tint }]}>{s.grammar.practiceAgain}</Text>
          </Pressable>
          {/* FB316 (NY10): nagy (>10 itemes) transform-leckén egy külön gomb a
              következő 10-es körre, ugyanaz a kézzelfogható lépés, mint a
              "Gyakorlás újra", csak a friss `transformSeen` térkép jelzi is. */}
          {drillKind === 'transform' && kindCounts.transform > TRANSFORM_ROUND_SIZE ? (
            <Pressable
              testID="grammar-more-round"
              style={[styles.btn, { backgroundColor: colors.tint }]}
              onPress={() => {
                setScore(null);
                setPhase('drill');
              }}
            >
              <Text style={[styles.btnText, styles.btnTextOnTint]}>{s.grammar.moreRound(TRANSFORM_ROUND_SIZE)}</Text>
            </Pressable>
          ) : null}
          <Pressable style={styles.ghostBtn} onPress={() => router.back()}>
            <Text style={[styles.ghostBtnText, { color: colors.tabIconDefault }]}>{s.grammar.backToSyllabus}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {header}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.body, g.brutal && styles.brutalPad]}
        onScroll={(e) => setScrollY(String(topicId), e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={100}
        onContentSizeChange={() => scrollRef.current?.scrollTo({ y: getScrollY(String(topicId)), animated: false })}
      >
        {isLessonV2(lesson) ? (
          <>
            {/* LECKE-SEMA 1+3: a body-blokkok váltják a rule/more prózát, a
                lesson.speak felolvasása egyetlen play<->stop gombbal. */}
            <Text style={[styles.sectionLabel, { color: accentText }]}>{s.grammar.ruleLabel}</Text>
            <Pressable testID="speakToggle" style={styles.readRow} onPress={toggleLessonSpeech} hitSlop={10}>
              <Text style={styles.speak}>{speaking ? '⏹' : '🔊'}</Text>
              <Text style={[styles.readLabel, { color: accentText }]}>{s.grammar.readAloud}</Text>
            </Pressable>
            <LessonBody blocks={lesson.body} contentLang={contentLang as 'hu' | 'en' | 'es' | 'de'} learnedLang={learnedLang} />
          </>
        ) : (
          <>
            <Text style={[styles.sectionLabel, { color: accentText }]}>{s.grammar.ruleLabel}</Text>
            <Card classicStyle={styles.card}>
              <Text style={[styles.ruleText, { color: colors.text }]}>{ruleText}</Text>
              {/* FB216: a hosszú magyarázatot fel is olvassa, a benne lévő spanyol
                  példákat spanyol hangon (lib/mixedSpeech.ts). */}
              <Pressable testID="grammar-read-rule" style={styles.readRow} onPress={() => readAloud(ruleText)} hitSlop={10}>
                <Text style={styles.speak}>🔊</Text>
                <Text style={[styles.readLabel, { color: accentText }]}>{s.grammar.readAloud}</Text>
              </Pressable>
            </Card>
          </>
        )}

        <Text style={[styles.sectionLabel, { color: accentText }]}>{s.grammar.examplesLabel}</Text>
        {worked.map((w, i) => (
          <Card key={i} classicStyle={styles.card}>
            <View style={styles.exampleRow}>
              <GlossText
                text={w.filled}
                glosses={buildGlossMap(w.filled, { learnedLang, nativeLang: contentLang, knownWordIds: knownIds, overrides })}
                learnedLang={learnedLang}
                style={[styles.exampleText, { color: colors.text }]}
              />
              <Pressable onPress={() => speak(w.filled, speechLang(learnedLang))} hitSlop={10}>
                <Text style={styles.speak}>🔊</Text>
              </Pressable>
            </View>
            <Text style={[styles.exampleWhy, { color: colors.tabIconDefault }]}>{w.why}</Text>
          </Card>
        ))}

        {'more' in lesson && lesson.more ? (
          <>
            <Text style={[styles.sectionLabel, { color: accentText }]}>{s.grammar.exceptionsLabel}</Text>
            <Card classicStyle={styles.card}>
              <MoreBlocks more={lesson.more} contentLang={contentLang} color={colors.text} />
              <Pressable
                testID="grammar-read-more"
                style={styles.readRow}
                onPress={() => readAloud(lesson.more?.[contentLang] ?? lesson.more?.en ?? '')}
                hitSlop={10}
              >
                <Text style={styles.speak}>🔊</Text>
                <Text style={[styles.readLabel, { color: accentText }]}>{s.grammar.readAloud}</Text>
              </Pressable>
            </Card>
          </>
        ) : null}

        {/* D3 (FB290): egy gomb fajtánként, hogy külön indítható legyen a
            mondatok / párosítás / ragozás, ne egyszerre az egész lecke.
            FB380: a gomb alatt a fajta SAJÁT %-a, ugyanazzal a lessonPercent
            logikával, ami a Kész-képernyő kinti számát adja. */}
        {availableKinds.map((kind, i) => {
          const kindPct = lessonPercent(kindAnswered[kind] ?? 0, kindCorrect[kind] ?? 0);
          return (
            <View key={kind}>
              {lessonButton(
                `grammar-start-${kind}`,
                kind === 'choice'
                    ? s.grammar.startChoice(kindCounts.choice)
                    : kind === 'match'
                      ? s.grammar.startMatch(kindCounts.match)
                      : kind === 'form'
                        ? s.grammar.startForm(kindCounts.form)
                        : kind === 'why'
                          ? s.grammar.startWhy(kindCounts.why)
                          : kindCounts.transform > TRANSFORM_ROUND_SIZE
                            ? s.grammar.startTransformRound(TRANSFORM_ROUND_SIZE, kindCounts.transform)
                            : s.grammar.startTransform(kindCounts.transform),
                () => {
                  setDrillKind(kind);
                  setPhase('drill');
                },
                true,
                i === 0
              )}
              {kindPct !== null ? (
                <Text testID={`grammar-kind-percent-${kind}`} style={[styles.kindPercentNote, { color: colors.tabIconDefault }]}>
                  {s.grammar.lessonPercent(kindPct)}
                </Text>
              ) : null}
            </View>
          );
        })}

        {/* PLAN-play 13. lépés (s6): the deck button only where the lesson has
            a conjugation table; outlined, to read as an optional extra next
            to the fajtánkénti drill gombok above. */}
        {tableDeckCells.length > 0 ? (
          lessonButton(
            'grammar-start-tabledeck',
            s.grammar.practiceTable(tableDeckCells.length),
            () => router.push(`/grammar/deck/${topicId}` as never),
            false,
            availableKinds.length === 0
          )
        ) : wordDeckCells.length >= WORD_DECK_MIN_CARDS ? (
          // FB375: same deck screen, the word-source variant (D5/a).
          lessonButton(
            'grammar-start-worddeck',
            s.grammar.practiceWords(wordDeckCells.length),
            () => router.push(`/grammar/deck/${topicId}` as never),
            false,
            availableKinds.length === 0
          )
        ) : null}
      </ScrollView>
      <FeedbackButton level={level} languagePair={`${contentLang}→${learnedLang}`} currentCard={`grammar:${topicId}:lesson`} />
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
    paddingTop: 12,
    paddingBottom: 6,
  },
  back: { fontSize: 22 },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', paddingHorizontal: 8 },
  levelTag: { fontSize: 13, fontWeight: '800', width: 28, textAlign: 'right' },
  body: { padding: 16, paddingBottom: 100, gap: 8 },
  sectionLabel: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 10 },
  card: { borderRadius: 14, padding: 14, gap: 6 },
  ruleText: { fontSize: 15, lineHeight: 23 },
  exampleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exampleText: { fontSize: 17, fontWeight: '600', flex: 1, lineHeight: 25 },
  exampleWhy: { fontSize: 13, lineHeight: 19 },
  speak: { fontSize: 18 },
  readRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  readLabel: { fontSize: 14, fontWeight: '700' },
  // Kálmán 2026-09-09: „ne legyen ilyen igénytelen a szöveg mező szépe az egyik
  // pici a másik nagy". Egy gomb-alak az egész képernyőn: azonos szélesség
  // (`alignSelf: 'stretch'`), azonos magasság (a kitöltött változaton is ott a
  // 1.5 átlátszó keret) és azonos betűméret. A kitöltött és a keretes gomb már
  // csak színben tér el.
  btn: {
    marginTop: 10,
    alignSelf: 'stretch',
    paddingVertical: 14,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  btnText: { fontSize: 16, fontWeight: '700' },
  startBtn: { marginTop: 18 },
  btnTextOnTint: { color: '#FFFFFF' },
  // NY23: neo-brutalista gombok, cím (nagybetűs, 500 súly).
  // A chat-gomb (FAB) alól is kigördül az utolsó gomb.
  brutalPad: { paddingBottom: 130 },
  brutalBack: { paddingVertical: 4, paddingHorizontal: 10 },
  brutalTitle: { fontWeight: '500', textTransform: 'uppercase' },
  brutalBtnWrap: { marginTop: 10, alignSelf: 'stretch' },
  brutalBtn: { paddingVertical: 14, alignItems: 'center' },
  brutalBtnText: { fontSize: 16, fontWeight: '500', textTransform: 'uppercase' },
  brutalDoneBody: { padding: 16, paddingBottom: 60, gap: 12 },
  brutalScoreBox: { padding: 24, alignItems: 'center', gap: 6 },
  brutalScore: { fontSize: 56, fontWeight: '500' },
  brutalNote: { fontSize: 13, fontWeight: '500', textAlign: 'center' },
  brutalComboPos: { position: 'absolute', top: -14, right: -8 },
  brutalStats: { flexDirection: 'row', gap: 10 },
  brutalStatWrap: { flex: 1 },
  brutalStat: { paddingVertical: 12, alignItems: 'center', gap: 2 },
  brutalStatValue: { fontSize: 20, fontWeight: '500' },
  brutalStatLabel: { fontSize: 11, fontWeight: '500', textTransform: 'uppercase' },
  brutalProgressBox: { padding: 14, gap: 8 },
  brutalMiss: { fontSize: 18, lineHeight: 26, fontWeight: '500' },
  brutalUnderline: { fontSize: 14, fontWeight: '500', textTransform: 'uppercase', textDecorationLine: 'underline' },
  ghostBtn: { marginTop: 12, padding: 8 },
  ghostBtnText: { fontSize: 14 },
  empty: { fontSize: 15, textAlign: 'center', marginTop: 60, paddingHorizontal: 30, lineHeight: 22 },
  doneBody: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 6 },
  doneEmoji: { fontSize: 56 },
  doneScore: { fontSize: 34, fontWeight: '800' },
  doneNote: { fontSize: 14, textAlign: 'center', marginBottom: 12 },
  // FB328: a kumulált "Eddig: NN%" sor, a pontszám és a "kész"-üzenet alatt.
  lessonPercentNote: { fontSize: 12, textAlign: 'center', marginTop: -6, marginBottom: 12 },
  // FB380: ugyanaz a sor-stílus, fajtánként a saját gombja alatt.
  kindPercentNote: { fontSize: 12, textAlign: 'center', marginTop: 2 },
});
