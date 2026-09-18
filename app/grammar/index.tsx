import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { getDb } from '@/lib/database';
import { LEVELS, type Level } from '@/data/words';
import {
  doneGrammarTopicProgress,
  GRAMMAR_PROGRESS_KEY,
  SYLLABUS_LEVELS,
  hasLesson,
  lessonCoverage,
  lessonFor,
  getGrammarTier,
  syllabusForLevel,
  topicsForUnit,
  unitsForLevel,
} from '@/lib/grammar/syllabus';
import { GRAMMAR_UNLOCK_SEEN_KEY, lockState, transformWordIds, type LockState } from '@/lib/grammar/lockState';
import FeedbackButton from '@/components/FeedbackModal';

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
  const s = t();
  const router = useRouter();

  const [learnedLang, setLearnedLang] = useState('es');
  const [contentLang, setContentLang] = useState('hu');
  const [level, setLevel] = useState<Level>('A1');
  const [openLevel, setOpenLevel] = useState<Level | null>(null);
  const [progress, setProgress] = useState<Map<string, TopicProgress>>(new Map());
  const [lockStates, setLockStates] = useState<Map<string, LockState>>(new Map());
  const [unlockBanner, setUnlockBanner] = useState<{ id: string; title: string } | null>(null);

  const load = useCallback(async () => {
    const db = getDb();
    const onboarding = await db.getOnboarding();
    const source = onboarding?.source ?? 'hu';
    const target = onboarding?.target ?? 'es';
    const cLang = source === 'hu' || source === 'es' || source === 'de' ? source : 'en';
    setLearnedLang(target);
    setContentLang(cLang);

    const levelData = await db.getLevel();
    const lvl = (levelData.level as Level) ?? 'A1';
    setLevel(lvl);
    setOpenLevel((current) => current ?? (LEVELS.includes(lvl) && lvl !== 'A0' ? lvl : 'A1'));

    // D3 (FB290): egy téma csak akkor "kész", ha a leckéjében létező összes
    // fajtájából van kész sor (doneGrammarTopicProgress, lib/grammar/syllabus.ts).
    const rows = await db.getGameProgress(GRAMMAR_PROGRESS_KEY);
    setProgress(doneGrammarTopicProgress(target, rows));

    // NY2 (NYELVTAN.md "Unlock-modell"): minden témára a transform-szavak
    // uniója EGY db.getWordStates hívásban, "ismert" = lap >= 3 VAGY buried
    // (db.getWordStates, az EGY definíció).
    const allTopics = SYLLABUS_LEVELS.flatMap((sl) => syllabusForLevel(sl));
    const lessons = new Map(allTopics.map((tp) => [tp.id, lessonFor(target, tp.id)] as const));
    const wordIds = new Set<number>();
    for (const lesson of lessons.values()) {
      if (!lesson) continue;
      for (const id of transformWordIds(lesson)) wordIds.add(Number(id));
    }
    const wordStates = await db.getWordStates([...wordIds]);
    const knownIds = new Set<string>();
    for (const [id, known] of wordStates) if (known === 1) knownIds.add(String(id));
    const nextLockStates = new Map<string, LockState>();
    for (const [topicId, lesson] of lessons) {
      nextLockStates.set(topicId, lesson ? lockState(lesson, knownIds) : { state: 'unlocked', have: 0, need: 0 });
    }
    setLockStates(nextLockStates);

    // Egyszeri sáv: az első unlocked+need>0 téma, ami még nincs a látott
    // halmazban; a sáv megjelenésekor AZONNAL "seen"-nek jelöljük, hogy
    // app-újraindítás után ne jöjjön újra (az X csak elrejti helyben).
    const seenRows = await db.getGameProgress(GRAMMAR_UNLOCK_SEEN_KEY);
    const seenIds = new Set(seenRows.map((r) => r.itemId));
    const toAnnounce = allTopics.find((tp) => {
      const ls = nextLockStates.get(tp.id);
      return !!ls && ls.state === 'unlocked' && ls.need > 0 && !seenIds.has(tp.id);
    });
    if (toAnnounce) {
      setUnlockBanner({ id: toAnnounce.id, title: toAnnounce.title[cLang] ?? toAnnounce.title.en });
      await db.setGameProgress(GRAMMAR_UNLOCK_SEEN_KEY, toAnnounce.id, 'seen');
    } else {
      setUnlockBanner(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const coverage = lessonCoverage(learnedLang);
  const doneCount = [...progress.values()].filter((p) => p.state === 'done').length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={[styles.back, { color: colors.text }]}>←</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>{s.grammar.title}</Text>
        <View style={{ width: 24 }} />
      </View>

      {unlockBanner ? (
        <View style={[styles.unlockBanner, { backgroundColor: colors.tint }]}>
          <Text style={[styles.unlockBannerText, { color: colors.onTint }]}>
            {s.grammar.unlockedBanner(unlockBanner.title)}
          </Text>
          <Pressable
            onPress={() => setUnlockBanner(null)}
            accessibilityLabel={s.grammar.dismiss}
            testID="grammar-unlock-banner-close"
            hitSlop={8}
          >
            <Text style={[styles.unlockBannerClose, { color: colors.onTint }]}>✕</Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={[styles.subtitle, { color: colors.tabIconDefault }]}>
        {s.grammar.coverage(doneCount, coverage.written, coverage.planned)}
      </Text>

      <ScrollView contentContainerStyle={styles.body}>
        {SYLLABUS_LEVELS.map((lvl) => {
          const topics = syllabusForLevel(lvl);
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
                ? unitsForLevel(lvl).map((unit) => (
                    <View key={unit.id} style={styles.unitBlock}>
                      <Text style={[styles.unitName, { color: colors.tint }]}>
                        {unit.title[contentLang] ?? unit.title.en}
                      </Text>
                      {topicsForUnit(unit.id).map((topic) => {
                        const written2 = hasLesson(learnedLang, topic.id);
                        const p = progress.get(topic.id);
                        // NY2: a zár-jelvények csak nem-kész sorra és csak akkor
                        // számítanak, ha a témának van transform-szava (need > 0).
                        const lock = lockStates.get(topic.id);
                        const showLock = written2 && p?.state !== 'done' && !!lock && lock.need > 0;
                        const badge = !written2
                          ? s.grammar.soon
                          : p?.state === 'done'
                            ? `✓ ${p.correct ?? 0}/${p.total ?? 0}`
                            : showLock && lock
                              ? lock.state === 'unlocked'
                                ? s.grammar.unlockedMeta(lock.have, lock.need)
                                : s.grammar.lockedMeta(lock.have, lock.need)
                              : p
                                ? s.grammar.started
                                : s.grammar.notStarted;
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
                                opacity: !written2 || (showLock && lock?.state === 'locked') ? 0.45 : 1,
                              },
                              p?.state === 'done' ? { borderLeftWidth: 4, borderLeftColor: '#22C55E' } : null,
                              showLock && lock?.state === 'unlocked' ? { borderWidth: 1, borderColor: colors.tint } : null,
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
                                {showLock && lock?.state === 'locked' ? (
                                  <Text
                                    testID={`grammar-lock-chip-${topic.id}`}
                                    style={[styles.lockChip, { color: colors.tabIconDefault, borderColor: colors.tabIconDefault }]}
                                  >
                                    {s.grammar.locked}
                                  </Text>
                                ) : null}
                              </View>
                              <Text style={[styles.topicBlurb, { color: colors.tabIconDefault }]} numberOfLines={2}>
                                {topic.blurb[contentLang] ?? topic.blurb.en}
                              </Text>
                            </View>
                            <Text
                              style={[
                                styles.topicBadge,
                                { color: p?.state === 'done' ? '#22C55E' : colors.tabIconDefault },
                              ]}
                            >
                              {badge}
                            </Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  back: { fontSize: 22 },
  title: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700' },
  subtitle: { fontSize: 13, textAlign: 'center', marginTop: 2, marginBottom: 8 },
  // NY2: az egyszeri "új téma feloldva" sáv, a fejléc alatt.
  unlockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginHorizontal: 14,
    marginTop: 10,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  unlockBannerText: { flex: 1, fontSize: 13, fontWeight: '600' },
  unlockBannerClose: { fontSize: 16, fontWeight: '700' },
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
  // NY2: a zárolt-témák chipje, a core/core-plus jelvények mintájára.
  lockChip: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  topicBlurb: { fontSize: 12, marginTop: 2, lineHeight: 17 },
  topicBadge: { fontSize: 12, fontWeight: '700' },
  footNote: { fontSize: 12, textAlign: 'center', marginTop: 18, lineHeight: 17 },
});
