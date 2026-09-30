import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import { getDb } from '@/lib/database';
import { LEVELS, type Level } from '@/data/words';
import {
  doneGrammarTopicProgress,
  GRAMMAR_PROGRESS_KEY,
  syllabusLevels,
  hasLesson,
  lessonCoverage,
  lessonKinds,
  lessonHasTrial,
  lessonFor,
  getGrammarTier,
  syllabusForLevel,
  topicsForUnit,
  unitsForLevel,
} from '@/lib/grammar/syllabus';
import { lessonBadgePercent, lessonScoresByTopic } from '@/lib/grammar/lessonScore';
import TrialBadge from '@/components/TrialBadge';
import { DEFAULT_WEEKLY_GOAL_MINUTES } from '@/lib/usageStats';
import FeedbackButton from '@/components/FeedbackModal';
import { BrutalBox, SegmentBar, Sticker, segmentsFilled } from '@/components/grammar/Brutal';

// The grammar course: the whole syllabus from A1 to C1, in teaching order.
//
// Kálmán, 2026-09-08: "külön legyen egy nyelvtani tanulás rész ahol szépen
// átveszi az összes nyelvtant... azt akarom, hogy átfogó legyen".
//
// The level the learner is on is open by default; every other level can be
// opened, because a grammar point is worth reading ahead of schedule and worth
// coming back to. A topic that has no written lesson yet says so instead of
// opening an empty screen.

interface TopicProgress {
  state: string;
  correct?: number;
  total?: number;
}

export default function GrammarSyllabusScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t();
  const router = useRouter();

  const [learnedLang, setLearnedLang] = useState('es');
  const [contentLang, setContentLang] = useState('en');
  const [level, setLevel] = useState<Level>('A1');
  const [openLevel, setOpenLevel] = useState<Level | null>(null);
  const [progress, setProgress] = useState<Map<string, TopicProgress>>(new Map());
  // FB328: leckénkénti kumulált helyes-arány, a sor jobb szélén lévő NN% jelvényhez.
  const [percents, setPercents] = useState<Map<string, number>>(new Map());
  // NY21: streak-matrica + heti cél doboz (a meglévő getStreak / heti cél / használat értékeiből).
  const [streak, setStreak] = useState(0);
  const [weeklyGoal, setWeeklyGoal] = useState(DEFAULT_WEEKLY_GOAL_MINUTES);
  const [weekMinutes, setWeekMinutes] = useState(0);

  const load = useCallback(async () => {
    const db = getDb();
    const onboarding = await db.getOnboarding();
    const target = onboarding?.target ?? 'es';
    setLearnedLang(target);
    // Kimacha Play: UI always English (Kálmán, 2026-09-22), regardless of the
    // stored source language; the syllabus data's hu/es/de fields stay unused.
    // es→en (Kálmán, 2026-09-28): a spanyol anyanyelvű tanuló spanyol magyarázatot kap.
    setContentLang(target === 'en' ? 'es' : 'en');

    const levelData = await db.getLevel();
    const lvl = (levelData.level as Level) ?? 'A1';
    setLevel(lvl);
    setOpenLevel((current) => current ?? (LEVELS.includes(lvl) && lvl !== 'A0' ? lvl : 'A1'));

    // D3 (FB290): egy téma csak akkor "kész", ha a leckéjében létező összes
    // fajtájából van kész sor (doneGrammarTopicProgress, lib/grammar/syllabus.ts).
    const rows = await db.getGameProgress(GRAMMAR_PROGRESS_KEY);
    setProgress(doneGrammarTopicProgress(target, rows));
    // FB328: ugyanabból a lekérésből, külön DB-hívás nélkül.
    // FB415: a lecke %-a az összes fajta átlaga (a meg nem csinált 0), nem a kumulált jó-arány.
    setPercents(lessonScoresByTopic(rows, (id) => lessonKinds(target, id)));
    setStreak((await db.getStreak())?.current_count ?? 0);
    setWeeklyGoal(await db.getWeeklyGoalMinutes());
    setWeekMinutes((await db.getUsageStats()).thisWeek);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const coverage = lessonCoverage(learnedLang);
  const doneCount = [...progress.values()].filter((p) => p.state === 'done').length;

  // NY21 (neo-brutalista, NYELVTAN.md "Neo-brutalista stílus" 1. képernyő):
  // a classic paletta a lenti mai kinézetet adja.
  if (g.brutal) {
    const shownLevel: Level = openLevel ?? 'A1';
    const shownTopics = syllabusForLevel(shownLevel, learnedLang);
    const shownWritten = shownTopics.filter((tp) => hasLesson(learnedLang, tp.id)).length;
    const shownDone = shownTopics.filter((tp) => progress.get(tp.id)?.state === 'done').length;
    return (
      <View style={[styles.container, { backgroundColor: g.bg }]}>
        <ScrollView contentContainerStyle={styles.brutalBody}>
          <View style={styles.brutalHeader}>
            <Text style={[styles.brutalTitle, { color: g.ink }]}>{s.tabs.grammar}</Text>
            <Sticker testID="grammar-streak" label={`🔥 ${streak}`} fill="b" rotate={6} />
          </View>
          <Text style={[styles.brutalSmall, { color: g.mu }]}>
            {s.grammar.coverage(doneCount, coverage.written, coverage.planned)}
          </Text>

          <View style={styles.brutalLevelRow}>
            {syllabusLevels(learnedLang).map((lvl) => (
              <BrutalBox
                key={lvl}
                testID={`grammar-level-${lvl}`}
                fill={shownLevel === lvl ? 'a' : 'paper'}
                style={styles.brutalLevelBox}
                boxStyle={styles.brutalLevelInner}
                onPress={() => setOpenLevel(lvl)}
              >
                <Text style={[styles.brutalLevelText, { color: shownLevel === lvl ? g.onFill : g.ink }]}>{lvl}</Text>
              </BrutalBox>
            ))}
          </View>
          <Text style={[styles.brutalSmall, { color: g.mu }]}>
            {s.grammar.levelMeta(shownDone, shownTopics.length, shownWritten)}
            {shownLevel === level ? ` · ${s.grammar.yourLevel}` : ''}
          </Text>

          {unitsForLevel(shownLevel, learnedLang).map((unit) => (
            <View key={unit.id} style={styles.brutalUnit}>
              <Text style={[styles.brutalUnitName, { color: g.mu }]}>
                {unit.title[contentLang] ?? unit.title.en}
              </Text>
              {topicsForUnit(unit.id, learnedLang).map((topic) => {
                const written2 = hasLesson(learnedLang, topic.id);
                const p = progress.get(topic.id);
                const pct = percents.get(topic.id) ?? null;
                const badgePct = lessonBadgePercent(pct, p?.correct, p?.total);
                const isDone = p?.state === 'done';
                const inProgress = written2 && !isDone && (badgePct !== null || !!p);
                const badge = !written2
                  ? `🔒 ${s.grammar.soon}`
                  : isDone
                    ? badgePct !== null
                      ? `✓ ${badgePct}%`
                      : `✓ ${p.correct ?? 0}/${p.total ?? 0}`
                    : badgePct !== null
                      ? `${badgePct}% · ${s.grammar.continueTag}`
                      : p
                        ? s.grammar.started
                        : s.grammar.notStarted;
                const tier = getGrammarTier(topic.id);
                const hasTrial = written2 && lessonHasTrial(lessonFor(learnedLang, topic.id));
                const textColor = inProgress ? g.onFill : written2 ? g.ink : g.mu;
                return (
                  <BrutalBox
                    key={topic.id}
                    testID={`grammar-topic-${topic.id}`}
                    fill={inProgress ? 'b' : 'paper'}
                    dashed={!written2}
                    disabled={!written2}
                    onPress={() => router.push(`/grammar/${topic.id}` as never)}
                    boxStyle={styles.brutalTopic}
                  >
                    <View style={styles.brutalTopicTop}>
                      <Text style={[styles.brutalTopicTitle, { color: textColor }]}>
                        {topic.title[contentLang] ?? topic.title.en}
                      </Text>
                    </View>
                    {tier || isDone || hasTrial ? (
                      <View style={styles.brutalStickers}>
                        {tier === 'core-plus' ? (
                          <Sticker testID={`grammar-core-plus-${topic.id}`} label={s.grammar.corePlusTag} fill="paper" rotate={-4} />
                        ) : tier === 'core' ? (
                          <Sticker testID={`grammar-core-${topic.id}`} label={s.grammar.coreTag} fill="paper" rotate={-4} />
                        ) : null}
                        {isDone ? <Sticker label={s.grammar.doneTag} fill="a" rotate={5} /> : null}
                        {/* PLAN-fb0929 7. lépés (D1): az új feladat-fajtás két lecke jelvénye. */}
                        {hasTrial ? <TrialBadge testID={`trial-badge-${topic.id}`} /> : null}
                      </View>
                    ) : null}
                    <Text style={[styles.brutalBlurb, { color: textColor }]} numberOfLines={2}>
                      {topic.blurb[contentLang] ?? topic.blurb.en}
                    </Text>
                    {inProgress && badgePct !== null ? (
                      <SegmentBar segments={6} filled={segmentsFilled(badgePct, 6)} style={styles.brutalBar} />
                    ) : null}
                    <Text testID={`grammar-percent-${topic.id}`} style={[styles.brutalBadge, { color: textColor }]}>
                      {badge}
                    </Text>
                  </BrutalBox>
                );
              })}
            </View>
          ))}

          <BrutalBox style={styles.brutalGoal} boxStyle={styles.brutalTopic}>
            <Text style={[styles.brutalUnitName, { color: g.ink }]}>{s.grammar.weeklyGoalTitle}</Text>
            <Text style={[styles.brutalBadge, { color: g.ink }]}>
              {s.grammar.weeklyGoalValue(
                String(Math.round((weekMinutes / 60) * 10) / 10),
                String(Math.round(weeklyGoal / 60))
              )}
            </Text>
            <SegmentBar
              segments={7}
              filled={segmentsFilled(weeklyGoal > 0 ? Math.min(100, (weekMinutes / weeklyGoal) * 100) : 0, 7)}
              style={styles.brutalBar}
            />
          </BrutalBox>

          <Text style={[styles.footNote, { color: g.mu }]}>{s.grammar.footNote}</Text>
        </ScrollView>

        <FeedbackButton level={level} languagePair={`${contentLang}→${learnedLang}`} currentCard="grammar-syllabus" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* K33 (play-vágás): ez már a Nyelvtan fül gyökere, nem push-olt képernyő,
          a cím+vissza sort a tab-navigátor saját fejléce adja (s.tabs.grammar). */}
      <Text style={[styles.subtitle, { color: colors.tabIconDefault, marginTop: 12 }]}>
        {s.grammar.coverage(doneCount, coverage.written, coverage.planned)}
      </Text>

      <ScrollView contentContainerStyle={styles.body}>
        {syllabusLevels(learnedLang).map((lvl) => {
          const topics = syllabusForLevel(lvl, learnedLang);
          const written = topics.filter((tp) => hasLesson(learnedLang, tp.id)).length;
          const done = topics.filter((tp) => progress.get(tp.id)?.state === 'done').length;
          const isOpen = openLevel === lvl;
          const isCurrent = lvl === level;

          return (
            <View key={lvl} style={styles.levelBlock}>
              <Pressable
                testID={`grammar-level-${lvl}`}
                style={[
                  styles.levelHeader,
                  { backgroundColor: colors.card, borderColor: isCurrent ? colors.tint : 'transparent' },
                ]}
                onPress={() => setOpenLevel(isOpen ? null : lvl)}
              >
                <Text style={[styles.levelName, { color: colors.text }]}>
                  {isOpen ? '▾' : '▸'} {lvl}
                  {isCurrent ? ` · ${s.grammar.yourLevel}` : ''}
                </Text>
                <Text style={[styles.levelMeta, { color: colors.tabIconDefault }]}>
                  {s.grammar.levelMeta(done, topics.length, written)}
                </Text>
              </Pressable>

              {isOpen
                ? unitsForLevel(lvl, learnedLang).map((unit) => (
                    <View key={unit.id} style={styles.unitBlock}>
                      <Text style={[styles.unitName, { color: colors.tint }]}>
                        {unit.title[contentLang] ?? unit.title.en}
                      </Text>
                      {topicsForUnit(unit.id, learnedLang).map((topic) => {
                        const written2 = hasLesson(learnedLang, topic.id);
                        const p = progress.get(topic.id);
                        // FB328: null amíg egyetlen kör sincs lejátszva a témán.
                        const pct = percents.get(topic.id) ?? null;
                        // FB328: EGY jelvény, nem kettő. Kész témán a kumulált
                        // százalék (vagy a régi haladásnál a kör eredménye)
                        // ül a ✓ mellett; elkezdett, nem kész témán önmagában.
                        const badgePct = lessonBadgePercent(pct, p?.correct, p?.total);
                        const badge = !written2
                          ? s.grammar.soon
                          : p?.state === 'done'
                            ? badgePct !== null
                              ? `✓ ${badgePct}%`
                              : `✓ ${p.correct ?? 0}/${p.total ?? 0}`
                            : badgePct !== null
                              ? `${badgePct}%`
                              : p
                                ? s.grammar.started
                                : s.grammar.notStarted;
                        const badgeColor =
                          badgePct !== null
                            ? badgePct >= 80
                              ? '#22C55E'
                              : badgePct >= 50
                                ? colors.warningFill
                                : colors.tabIconDefault
                            : p?.state === 'done'
                              ? '#22C55E'
                              : colors.tabIconDefault;
                        return (
                          <Pressable
                            key={topic.id}
                            testID={`grammar-topic-${topic.id}`}
                            disabled={!written2}
                            onPress={() => router.push(`/grammar/${topic.id}` as never)}
                            style={[
                              styles.topicRow,
                              {
                                backgroundColor: colors.card,
                                opacity: !written2 ? 0.45 : 1,
                              },
                              p?.state === 'done' ? { borderLeftWidth: 4, borderLeftColor: '#22C55E' } : null,
                            ]}
                          >
                            <View style={{ flex: 1 }}>
                              <View style={styles.topicTitleRow}>
                                <Text style={[styles.topicTitle, { color: colors.text }]}>
                                  {topic.title[contentLang] ?? topic.title.en}
                                </Text>
                                {getGrammarTier(topic.id) === 'core-plus' ? (
                                  <Text testID={`grammar-core-plus-${topic.id}`} style={styles.corePlusTag}>
                                    {s.grammar.corePlusTag}
                                  </Text>
                                ) : getGrammarTier(topic.id) === 'core' ? (
                                  <Text testID={`grammar-core-${topic.id}`} style={styles.coreTag}>
                                    {s.grammar.coreTag}
                                  </Text>
                                ) : null}
                              </View>
                              <Text style={[styles.topicBlurb, { color: colors.tabIconDefault }]} numberOfLines={2}>
                                {topic.blurb[contentLang] ?? topic.blurb.en}
                              </Text>
                            </View>
                            <View style={styles.topicBadgeCol}>
                              <Text
                                testID={`grammar-percent-${topic.id}`}
                                style={[styles.topicBadge, { color: badgeColor }]}
                              >
                                {badge}
                              </Text>
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  ))
                : null}
            </View>
          );
        })}

        <Text style={[styles.footNote, { color: colors.tabIconDefault }]}>{s.grammar.footNote}</Text>
      </ScrollView>

      <FeedbackButton level={level} languagePair={`${contentLang}→${learnedLang}`} currentCard="grammar-syllabus" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  subtitle: { fontSize: 13, textAlign: 'center', marginTop: 2, marginBottom: 8 },
  body: { padding: 14, paddingBottom: 100, gap: 10 },
  levelBlock: { gap: 8 },
  levelHeader: { borderRadius: 14, borderWidth: 1.5, padding: 14, gap: 2 },
  levelName: { fontSize: 17, fontWeight: '800' },
  levelMeta: { fontSize: 12 },
  unitBlock: { gap: 6, paddingLeft: 6 },
  unitName: { fontSize: 13, fontWeight: '700', marginTop: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  topicRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 12 },
  topicTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  topicTitle: { fontSize: 15, fontWeight: '600' },
  // Telt lila: a beszéd-mag, ez épül legelőbb.
  corePlusTag: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#FFFFFF',
    backgroundColor: '#7C3AED',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  // Lila jelölés: ez a téma kell ahhoz, hogy beszélni tudjon, akkor is látszik,
  // ha a lecke még nincs megírva.
  coreTag: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#7C3AED',
    borderColor: '#7C3AED',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  topicBlurb: { fontSize: 12, marginTop: 2, lineHeight: 17 },
  topicBadgeCol: { alignItems: 'flex-end', gap: 2 },
  topicBadge: { fontSize: 12, fontWeight: '700' },
  // NY21: neo-brutalista forma-stílusok (címek, gombok nagybetűsek, 500 súly).
  // paddingBottom: az utolsó kártya a chat-gomb (FAB) alól is kigördül.
  brutalBody: { padding: 16, paddingBottom: 130, gap: 10 },
  brutalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brutalTitle: { fontSize: 30, fontWeight: '500', textTransform: 'uppercase' },
  brutalSmall: { fontSize: 11, fontWeight: '500' },
  brutalLevelRow: { flexDirection: 'row', gap: 8 },
  brutalLevelBox: { flex: 1 },
  brutalLevelInner: { paddingVertical: 8, alignItems: 'center' },
  brutalLevelText: { fontSize: 14, fontWeight: '500' },
  brutalUnit: { gap: 10 },
  brutalUnitName: { fontSize: 11, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 6 },
  brutalTopic: { padding: 12, gap: 6 },
  brutalTopicTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  brutalTopicTitle: { flexShrink: 1, fontSize: 15, fontWeight: '500', textTransform: 'uppercase' },
  brutalStickers: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  brutalBlurb: { fontSize: 12, lineHeight: 17 },
  brutalBar: { marginTop: 2 },
  brutalBadge: { fontSize: 12, fontWeight: '500', textTransform: 'uppercase' },
  brutalGoal: { marginTop: 10 },
  footNote: { fontSize: 12, textAlign: 'center', marginTop: 18, lineHeight: 17 },
});
