import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { getDb } from '@/lib/database';
import { normalizeWordToken, type Level } from '@/data/words';
import { cumulativeCorpusWordIds, type GrammarTopicData } from '@/lib/games/content';
import { buildGlossMap } from '@/lib/games/gloss';
import { GRAMMAR_PROGRESS_KEY, lessonFor, syllabusTopic } from '@/lib/grammar/syllabus';
import { speak } from '@/lib/speech';
import { speechLang } from '@/lib/languages';
import GlossText from '@/components/games/GlossText';
import GrammarDrill from '@/components/grammar/GrammarDrill';
import FeedbackButton from '@/components/FeedbackModal';

// One grammar lesson: the rule first, then the practice.
//
// The lesson READS (rule, the exceptions block, worked examples you can tap for
// meaning and hear spoken), and only then drills, because the Game tab's
// grammar-choice already covers "drill first, explanation after" and the point
// of the course is the other order: understand, then check.

type Phase = 'lesson' | 'drill' | 'done';

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

  const load = useCallback(async () => {
    const db = getDb();
    const onboarding = await db.getOnboarding();
    const source = onboarding?.source ?? 'hu';
    const target = onboarding?.target ?? 'es';
    setLearnedLang(target);
    setContentLang(source === 'hu' || source === 'es' || source === 'de' ? source : 'en');
    const levelData = await db.getLevel();
    setLevel((levelData.level as Level) ?? 'A1');
    setLesson(lessonFor(target, String(topicId)) ?? null);
  }, [topicId]);

  useEffect(() => {
    load();
  }, [load]);

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

  const lessonTitle = lesson.title[contentLang] ?? lesson.title.en;
  const knownIds = cumulativeCorpusWordIds(lesson.level, learnedLang);
  const overrides = Object.fromEntries((lesson.glossary ?? []).map((g) => [normalizeWordToken(g.word), g.gloss]));

  // Two worked examples from the first items, so the lesson SHOWS the rule
  // before it asks anything.
  const worked = lesson.items.slice(0, 3).map((item) => ({
    filled: item.sentence.replace('___', item.options[item.correct]),
    why: item.why[contentLang] ?? item.why.en,
  }));

  const finish = async (correct: number, total: number) => {
    setScore({ correct, total });
    setPhase('done');
    getDb()
      .setGameProgress(GRAMMAR_PROGRESS_KEY, String(topicId), 'done', { correct, total })
      .catch(() => {});
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
        <GrammarDrill topic={lesson} learnedLang={learnedLang} contentLang={contentLang} onFinish={finish} />
        <FeedbackButton level={level} languagePair={`${contentLang}→${learnedLang}`} currentCard={`grammar:${topicId}:drill`} />
      </View>
    );
  }

  if (phase === 'done' && score) {
    const pct = score.total ? Math.round((score.correct / score.total) * 100) : 0;
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
          <Pressable style={[styles.primaryBtn, { backgroundColor: colors.tint }]} onPress={() => setPhase('lesson')}>
            <Text style={styles.primaryBtnText}>{s.grammar.backToRule}</Text>
          </Pressable>
          <Pressable
            testID="grammar-practice-again"
            style={[styles.secondaryBtn, { borderColor: colors.tint }]}
            onPress={() => {
              setScore(null);
              setPhase('drill');
            }}
          >
            <Text style={[styles.secondaryBtnText, { color: colors.tint }]}>{s.grammar.practiceAgain}</Text>
          </Pressable>
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
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[styles.sectionLabel, { color: colors.tint }]}>{s.grammar.ruleLabel}</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.ruleText, { color: colors.text }]}>{lesson.rule[contentLang] ?? lesson.rule.en}</Text>
        </View>

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

        {lesson.more ? (
          <>
            <Text style={[styles.sectionLabel, { color: colors.tint }]}>{s.grammar.exceptionsLabel}</Text>
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <Text style={[styles.ruleText, { color: colors.text }]}>{lesson.more[contentLang] ?? lesson.more.en}</Text>
            </View>
          </>
        ) : null}

        <Pressable
          testID="grammar-start-drill"
          style={[styles.primaryBtn, { backgroundColor: colors.tint }]}
          onPress={() => setPhase('drill')}
        >
          <Text style={styles.primaryBtnText}>{s.grammar.startDrill(lesson.items.length)}</Text>
        </Pressable>
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
  primaryBtn: { marginTop: 18, paddingVertical: 15, borderRadius: 26, alignItems: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  secondaryBtn: { marginTop: 10, paddingVertical: 13, borderRadius: 26, borderWidth: 1.5, alignItems: 'center', alignSelf: 'stretch' },
  secondaryBtnText: { fontSize: 15, fontWeight: '600' },
  ghostBtn: { marginTop: 12, padding: 8 },
  ghostBtnText: { fontSize: 14 },
  empty: { fontSize: 15, textAlign: 'center', marginTop: 60, paddingHorizontal: 30, lineHeight: 22 },
  doneBody: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 6 },
  doneEmoji: { fontSize: 56 },
  doneScore: { fontSize: 34, fontWeight: '800' },
  doneNote: { fontSize: 14, textAlign: 'center', marginBottom: 12 },
});
