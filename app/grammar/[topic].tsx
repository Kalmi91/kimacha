import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { getDb } from '@/lib/database';
import { normalizeWordToken, type Level } from '@/data/words';
import { cumulativeCorpusWordIds, grammarKindCounts, isLessonV2, type GrammarGapItem, type GrammarItem, type GrammarKind, type GrammarTopicData } from '@/lib/games/content';
import { buildGlossMap } from '@/lib/games/gloss';
import { GRAMMAR_PROGRESS_KEY, lessonFor, nextWrittenTopic, syllabusTopic } from '@/lib/grammar/syllabus';
import { lessonWordIds, lockState, type LockState } from '@/lib/grammar/lockState';
import { TRANSFORM_ROUND_SIZE } from '@/lib/grammar/transformRounds';
import { setFocusWords } from '@/lib/focusWords';
import { setPendingAction } from '@/lib/pendingAction';
import { speak, speakSequence, stopSpeaking } from '@/lib/speech';
import { splitByLanguage, splitByMarkers } from '@/lib/mixedSpeech';
import { speechLang } from '@/lib/languages';
import GlossText from '@/components/games/GlossText';
import GrammarDrill from '@/components/grammar/GrammarDrill';
import LessonBody from '@/components/grammar/LessonBody';
import MoreBlocks from '@/components/grammar/MoreBlocks';
import FeedbackButton from '@/components/FeedbackModal';
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
  const s = t();
  const router = useRouter();
  const { topic: topicId } = useLocalSearchParams<{ topic: string }>();

  const [learnedLang, setLearnedLang] = useState('es');
  const [contentLang, setContentLang] = useState('hu');
  const [level, setLevel] = useState<Level>('A1');
  const [lesson, setLesson] = useState<GrammarTopicData | null>(null);
  const [phase, setPhase] = useState<Phase>('lesson');
  const [score, setScore] = useState<{ correct: number; total: number } | null>(null);
  // D3 (FB290): melyik fajtát indította el a tanuló (a gombja szerint), ez megy
  // a GrammarDrill `kinds` propjába és a haladás-sor kulcsába is.
  const [drillKind, setDrillKind] = useState<GrammarKind>('choice');
  // LECKE-SEMA 3.3: a V2 lecke egyetlen (play → stop) gombja a lesson.speak
  // felolvasásához; leállítás gombnyomásra, fázisváltáskor és unmountkor is.
  const [speaking, setSpeaking] = useState(false);
  // FB315 (NY9): a lecke transform-szavainak zár-állapota, az "Ezen szavak
  // tanulása" gomb N-jéhez (need - have).
  const [lock, setLock] = useState<LockState>({ state: 'unlocked', have: 0, need: 0 });
  // FB316 (NY10): hányszor gyakorolt már egy-egy transform item (itemId -> n),
  // ez dönti el a következő 10-es kör sorrendjét (legkevésbé gyakorolt elöl).
  const [transformSeen, setTransformSeen] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    const db = getDb();
    const onboarding = await db.getOnboarding();
    const source = onboarding?.source ?? 'hu';
    const target = onboarding?.target ?? 'es';
    setLearnedLang(target);
    setContentLang(source === 'hu' || source === 'es' || source === 'de' ? source : 'en');
    const levelData = await db.getLevel();
    setLevel((levelData.level as Level) ?? 'A1');
    const loadedLesson = lessonFor(target, String(topicId)) ?? null;
    setLesson(loadedLesson);
    // FB315 (NY9): a zár-állapot ugyanúgy, mint a lecke-listán (app/grammar/index.tsx).
    if (loadedLesson) {
      const wordIds = lessonWordIds(loadedLesson).map(Number);
      const wordStates = await db.getWordStates(wordIds);
      const knownIds = new Set<string>();
      for (const [id, known] of wordStates) if (known === 1) knownIds.add(String(id));
      setLock(lockState(loadedLesson, knownIds));
      // FB316 (NY10): a kör indítása előtt betöltjük, melyik transform item
      // hányszor gyakorolt, hogy a legkevésbé gyakorolt kerülhessen elöre.
      const progressRows = await db.getGameProgress(GRAMMAR_PROGRESS_KEY);
      const seenRow = progressRows.find((r) => r.itemId === `${String(topicId)}:transform:seen`);
      setTransformSeen((seenRow?.data as Record<string, number>) ?? {});
    } else {
      setLock({ state: 'unlocked', have: 0, need: 0 });
      setTransformSeen({});
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

  const entry = syllabusTopic(String(topicId));

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

  const header = (
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

  if (phase === 'drill') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {header}
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
        />
        <FeedbackButton level={level} languagePair={`${contentLang}→${learnedLang}`} currentCard={`grammar:${topicId}:drill`} />
      </View>
    );
  }

  if (phase === 'done' && score) {
    const pct = score.total ? Math.round((score.correct / score.total) * 100) : 0;
    // Kálmán 2026-09-09: a Kész-képernyőről tovább lehessen lépni a következő
    // témára. Csak megírt leckére kínáljuk fel, üres képernyőre nem viszünk.
    const next = nextWrittenTopic(learnedLang, String(topicId));
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

  // FB315 (NY9): N = a lecke transform-szavaiból még nem ismert szavak száma;
  // a gomb csak akkor jelenik meg, ha van ilyen.
  const needWords = lock.need - lock.have;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {header}
      {needWords > 0 ? (
        <Pressable
          testID="grammar-learn-words"
          style={[styles.btn, styles.learnWordsBtn, { backgroundColor: colors.tint }]}
          onPress={() => {
            setFocusWords({ topicId: String(topicId), label: lessonTitle, wordIds: lessonWordIds(lesson).map(Number) });
            setPendingAction({ type: 'focusWords' });
            router.push('/');
          }}
        >
          <Text style={[styles.btnText, styles.btnTextOnTint]}>{s.grammar.learnTheseWords(needWords)}</Text>
        </Pressable>
      ) : null}
      <ScrollView contentContainerStyle={styles.body}>
        {isLessonV2(lesson) ? (
          <>
            {/* LECKE-SEMA 1+3: a body-blokkok váltják a rule/more prózát, a
                lesson.speak felolvasása egyetlen play<->stop gombbal. */}
            <Text style={[styles.sectionLabel, { color: colors.tint }]}>{s.grammar.ruleLabel}</Text>
            <Pressable testID="speakToggle" style={styles.readRow} onPress={toggleLessonSpeech} hitSlop={10}>
              <Text style={styles.speak}>{speaking ? '⏹' : '🔊'}</Text>
              <Text style={[styles.readLabel, { color: colors.tint }]}>{s.grammar.readAloud}</Text>
            </Pressable>
            <LessonBody blocks={lesson.body} contentLang={contentLang as 'hu' | 'en' | 'es' | 'de'} learnedLang={learnedLang} />
          </>
        ) : (
          <>
            <Text style={[styles.sectionLabel, { color: colors.tint }]}>{s.grammar.ruleLabel}</Text>
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <Text style={[styles.ruleText, { color: colors.text }]}>{ruleText}</Text>
              {/* FB216: a hosszú magyarázatot fel is olvassa, a benne lévő spanyol
                  példákat spanyol hangon (lib/mixedSpeech.ts). */}
              <Pressable testID="grammar-read-rule" style={styles.readRow} onPress={() => readAloud(ruleText)} hitSlop={10}>
                <Text style={styles.speak}>🔊</Text>
                <Text style={[styles.readLabel, { color: colors.tint }]}>{s.grammar.readAloud}</Text>
              </Pressable>
            </View>
          </>
        )}

        <Text style={[styles.sectionLabel, { color: colors.tint }]}>{s.grammar.examplesLabel}</Text>
        {worked.map((w, i) => (
          <View key={i} style={[styles.card, { backgroundColor: colors.card }]}>
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
          </View>
        ))}

        {'more' in lesson && lesson.more ? (
          <>
            <Text style={[styles.sectionLabel, { color: colors.tint }]}>{s.grammar.exceptionsLabel}</Text>
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <MoreBlocks more={lesson.more} contentLang={contentLang} color={colors.text} />
              <Pressable
                testID="grammar-read-more"
                style={styles.readRow}
                onPress={() => readAloud(lesson.more?.[contentLang] ?? lesson.more?.en ?? '')}
                hitSlop={10}
              >
                <Text style={styles.speak}>🔊</Text>
                <Text style={[styles.readLabel, { color: colors.tint }]}>{s.grammar.readAloud}</Text>
              </Pressable>
            </View>
          </>
        ) : null}

        {/* D3 (FB290): egy gomb fajtánként, hogy külön indítható legyen a
            mondatok / párosítás / ragozás, ne egyszerre az egész lecke. */}
        {availableKinds.map((kind, i) => (
          <Pressable
            key={kind}
            testID={`grammar-start-${kind}`}
            style={[styles.btn, i === 0 && styles.startBtn, { backgroundColor: colors.tint }]}
            onPress={() => {
              setDrillKind(kind);
              setPhase('drill');
            }}
          >
            <Text style={[styles.btnText, styles.btnTextOnTint]}>
              {kind === 'choice'
                ? s.grammar.startChoice(kindCounts.choice)
                : kind === 'match'
                  ? s.grammar.startMatch(kindCounts.match)
                  : kind === 'form'
                    ? s.grammar.startForm(kindCounts.form)
                    : kind === 'why'
                      ? s.grammar.startWhy(kindCounts.why)
                      : kindCounts.transform > TRANSFORM_ROUND_SIZE
                        ? s.grammar.startTransformRound(TRANSFORM_ROUND_SIZE, kindCounts.transform)
                        : s.grammar.startTransform(kindCounts.transform)}
            </Text>
          </Pressable>
        ))}
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
  // FB315 (NY9): a gomb a ScrollView-n kívül ül, a 16px oldalpárnázást pótolja.
  learnWordsBtn: { marginHorizontal: 16 },
  btnTextOnTint: { color: '#FFFFFF' },
  ghostBtn: { marginTop: 12, padding: 8 },
  ghostBtnText: { fontSize: 14 },
  empty: { fontSize: 15, textAlign: 'center', marginTop: 60, paddingHorizontal: 30, lineHeight: 22 },
  doneBody: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 6 },
  doneEmoji: { fontSize: 56 },
  doneScore: { fontSize: 34, fontWeight: '800' },
  doneNote: { fontSize: 14, textAlign: 'center', marginBottom: 12 },
});
