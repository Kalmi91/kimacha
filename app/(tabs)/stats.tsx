import { useCallback, useState } from 'react';
import { StyleSheet, View, ScrollView, Pressable } from 'react-native';
import { Text } from '@/components/KText';
import { useFocusEffect, useRouter } from 'expo-router';
import Colors from '@/constants/Colors';
import { legibleOn } from '@/constants/Skins';
import { useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { getDb } from '@/lib/database';
import { t } from '@/lib/i18n';
import { languages } from '@/lib/languages';
import {
  weeklyGoalProgress,
  DEFAULT_WEEKLY_GOAL_MINUTES,
  localDateString,
  type UsageStats,
} from '@/lib/usageStats';
import {
  buildSchedulePreview,
  daysUntil,
  type SchedulePreview,
  type ScheduleBucketKey,
} from '@/lib/schedulePreview';
import { PCIC_VIEW_LEVELS, pcicItemsForLevel, type PcicLevel } from '@/data/pcic';
import { cardsForLevel } from '@/lib/pcicLevels';
import { countKnown, countGraduated, countLearned } from '@/lib/pcicStats';
import { countDoneToday } from '@/lib/pcicSession';
import FeedbackButton from '@/components/FeedbackModal';
import { Card, SegmentBar, Sticker, segmentsFilled } from '@/components/grammar/Brutal';
import { SkinBackdrop } from '@/components/skins/Slots';
import MockExamCard from '@/components/exam/MockExamCard';
import { MOCK_LEVELS } from '@/lib/exam/mock/blueprint';
import { readMockOverview, type MockOverview } from '@/lib/exam/mock/session';
import type { MockLevel, MockTarget } from '@/lib/exam/mock/types';

const EMPTY_SCHEDULE: SchedulePreview = { dueNow: 0, buckets: [], scheduled: 0, nextDue: null };

const EMPTY_STATS: UsageStats = {
  today: 0,
  thisWeek: 0,
  allTimeTotal: 0,
  last7Days: [],
  last30Days: [],
  bestDay: null,
  daysActive: 0,
};

export default function StatsScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();
  const router = useRouter();
  const [usage, setUsage] = useState<UsageStats>(EMPTY_STATS);
  const [streak, setStreak] = useState(0);
  // "known" = interval >= 21 days, globally (the 4
  // PCIC levels combined); "graduated" = got past the learning steps
  // (state 'review'), even below the threshold (lib/pcicStats.ts).
  const [known, setKnown] = useState(0);
  const [graduated, setGraduated] = useState(0);
  const [reviewsToday, setReviewsToday] = useState(0);
  const [weeklyGoal, setWeeklyGoal] = useState(DEFAULT_WEEKLY_GOAL_MINUTES);
  const [schedule, setSchedule] = useState<SchedulePreview>(EMPTY_SCHEDULE);
  // The PCIC level (A1-C1), set by the PCIC tab's level picker,
  // instead of the old FSRS level (A0-C2).
  const [pcicLevel, setPcicLevel] = useState<PcicLevel>('B1');
  const [levelKnown, setLevelKnown] = useState(0);
  const [levelTotal, setLevelTotal] = useState(0);
  const [otherLevels, setOtherLevels] = useState<{ level: PcicLevel; known: number }[]>([]);
  const [targetLang, setTargetLang] = useState('es');
  const [sourceLang, setSourceLang] = useState('en');
  // The mock exam card's levels (direction-dependent) and the saved results.
  const [mockLevels, setMockLevels] = useState<readonly MockLevel[]>(MOCK_LEVELS.es);
  const [mockOverview, setMockOverview] = useState<MockOverview>({});
  const [mockOfficial, setMockOfficial] = useState(true);
  // The daily bar is shown in hours above 60 minutes, and switches to minutes on tap.
  const [chartInMinutes, setChartInMinutes] = useState(false);

  // Refresh every time the tab gains focus so numbers stay current across app-wide activity.
  useFocusEffect(
    useCallback(() => {
      const db = getDb();
      db.getUsageStats().then(setUsage);
      db.getStreak().then(r => setStreak(r.current_count));
      db.getWeeklyGoalMinutes().then(setWeeklyGoal);
      db.getOnboarding().then(ob => {
        setTargetLang(ob?.target ?? 'es');
        setSourceLang(ob?.source ?? 'en');
        const mockTarget: MockTarget = ob?.target === 'en' ? 'en' : 'es';
        setMockLevels(MOCK_LEVELS[mockTarget]);
        setMockOfficial(mockTarget === 'es');
        readMockOverview(db, mockTarget, MOCK_LEVELS[mockTarget]).then(setMockOverview);
      });
      // All PCIC computation comes from a single getPcicCards()
      // call (as on the PCIC tab); the filtering/aggregation is in pure functions.
      db.getPcicLevel().then(async lvl => {
        setPcicLevel(lvl);
        const cards = await db.getPcicCards();
        const today = localDateString();
        setReviewsToday(countDoneToday(cards, today));
        setKnown(countKnown(cards));
        setGraduated(countGraduated(cards));
        const selCards = cardsForLevel(cards, lvl);
        // The card counts learned words (not the few words that reached the 21-day threshold).
        setLevelKnown(countLearned(selCards));
        setLevelTotal(pcicItemsForLevel(lvl).length);
        setOtherLevels(PCIC_VIEW_LEVELS.filter(l => pcicItemsForLevel(l).length > 0).map(l => ({ level: l, known: countLearned(cardsForLevel(cards, l)) })));
        // Pattern for PCIC dates: completes the bare 'YYYY-MM-DD' due to local midnight,
        // otherwise `new Date('YYYY-MM-DD')` parses UTC midnight and in a zone with a
        // negative UTC offset (e.g. CDMX) it would slip a day earlier.
        const dueDates = selCards.filter(c => c.due).map(c => `${c.due}T00:00:00`);
        setSchedule(buildSchedulePreview(dueDates, new Date()));
      });
    }, [])
  );

  const targetLangInfo = languages.find(l => l.code === targetLang);
  const sourceLangInfo = languages.find(l => l.code === sourceLang);

  const g = useGrammarColors();
  // On the brutalist palette the big numbers are in ink at weight 500 (the a / b color may be unreadable on paper).
  const tileValueStyle = (c: string) => [styles.tileValue, g.brutal ? { color: g.ink, fontWeight: '500' as const } : { color: c }];
  const maxMinutes = Math.max(1, ...usage.last7Days.map(d => d.minutes));
  const hasChartData = usage.last7Days.some(d => d.minutes > 0);
  const goal = weeklyGoalProgress(usage.thisWeek, weeklyGoal);

  // Minutes as hours with one decimal, dropping a trailing ".0" (7.0 -> "7").
  const hours = (minutes: number) => {
    const value = Math.round((minutes / 60) * 10) / 10;
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  };

  // dateStr is local YYYY-MM-DD (see lib/usageStats.ts); a short weekday
  // label for the bar chart, built from Date's own locale formatting so we
  // don't need a new dependency for day names.
  const bucketLabel: Record<ScheduleBucketKey, string> = {
    today: s.stats.scheduleToday,
    tomorrow: s.stats.scheduleTomorrow,
    days2to3: s.stats.scheduleDays2to3,
    days4to7: s.stats.scheduleDays4to7,
    later: s.stats.scheduleLater,
  };

  // "when does it refresh" in the learner's own words: a clock time while the
  // next card is close, a day count once it is further out.
  const nextRefreshLabel = (iso: string) => {
    const due = new Date(iso);
    const days = daysUntil(due, new Date());
    const time = due.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    if (days <= 0) return s.stats.scheduleNextToday(time);
    if (days === 1) return s.stats.scheduleNextTomorrow(time);
    return s.stats.scheduleNextDays(days);
  };

  const weekdayLabel = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SkinBackdrop />
      <ScrollView style={styles.container} contentContainerStyle={[styles.content, g.brutal && styles.brutalContent]}>
        <Text variant="title" style={[styles.title, { color: colors.text }, g.brutal && styles.brutalTitle]}>{s.stats.title}</Text>

      {/* badge of the PCIC level + known/total (interval
          >= 21 days), below it the known count of the other 3 PCIC levels. */}
      <Text style={[styles.sectionLabel, { color: colors.tabIconDefault }]}>{s.progress.wordsKnown}</Text>
      <Card classicStyle={styles.levelCard} style={styles.gapBottom}>
        <View style={styles.levelCardHead}>
          {g.brutal ? (
            <Sticker label={pcicLevel} fill="a" rotate={-4} textStyle={styles.brutalBadgeText} />
          ) : (
          <View style={[styles.levelBadge, { backgroundColor: legibleOn('#38BDF8', '#FFFFFF') }]}>
            <Text style={styles.levelBadgeText}>{pcicLevel}</Text>
          </View>
          )}
          <Text style={[styles.levelCardValue, { color: colors.text }]}>
            {s.header.levelProgress(levelKnown, levelTotal)}
          </Text>
        </View>
        {/* no gem grid here, just which language we learn from and to;
            the count above says how many words the level has and how many stuck. */}
        <Text style={[styles.levelCardPair, { color: colors.tabIconDefault }]}>
          {sourceLangInfo?.flag ?? ''} {sourceLangInfo?.name ?? sourceLang} → {targetLangInfo?.flag ?? ''}{' '}
          {targetLangInfo?.name ?? targetLang}
        </Text>
        <Text style={[styles.levelCardOthers, { color: colors.tabIconDefault }]}>
          {otherLevels.map(r => s.stats.knownAtLevel(r.level, r.known)).join('  ·  ')}
        </Text>
      </Card>

      <MockExamCard
        levels={mockLevels}
        overview={mockOverview}
        official={mockOfficial}
        onStart={level => router.push({ pathname: '/mock-exam', params: { level } })}
      />

      <View style={styles.tileRow}>
        <Card style={styles.tile} classicStyle={styles.tileClassic} boxStyle={styles.tileBox}>
          {/* spell out the unit, a bare number left it unclear that
              today's app time is counted in minutes. */}
          <Text style={tileValueStyle(colors.tint)}>{s.stats.minutes(usage.today)}</Text>
          <Text style={[styles.tileLabel, { color: colors.tabIconDefault }]}>{s.stats.today}</Text>
        </Card>
        <Card style={styles.tile} classicStyle={styles.tileClassic} boxStyle={styles.tileBox}>
          <Text style={tileValueStyle(colors.tint)}>{usage.thisWeek}</Text>
          <Text style={[styles.tileLabel, { color: colors.tabIconDefault }]}>{s.stats.thisWeek}</Text>
        </Card>
      </View>
      <View style={styles.tileRow}>
        <Card style={styles.tile} classicStyle={styles.tileClassic} boxStyle={styles.tileBox}>
          <Text style={tileValueStyle(colors.tint)}>{usage.allTimeTotal}</Text>
          <Text style={[styles.tileLabel, { color: colors.tabIconDefault }]}>{s.stats.allTime}</Text>
        </Card>
        <Card style={styles.tile} classicStyle={styles.tileClassic} boxStyle={styles.tileBox}>
          <Text style={tileValueStyle(colors.tint)}>{usage.daysActive}</Text>
          <Text style={[styles.tileLabel, { color: colors.tabIconDefault }]}>{s.stats.daysActive}</Text>
        </Card>
      </View>

      {usage.bestDay && (
        <Card classicStyle={styles.bestDayRow} style={styles.gapBottom}>
          <Text style={[styles.tileLabel, { color: colors.tabIconDefault }]}>{s.stats.bestDay}</Text>
          <Text style={[styles.bestDayValue, { color: colors.text }]}>
            {usage.bestDay.date} · {s.stats.minutes(usage.bestDay.minutes)}
          </Text>
        </Card>
      )}

      {/* weekly goal, the rolling 7-day total measured against the target
          set in Settings, with an explicit warning while it's still short. */}
      <Text style={[styles.sectionLabel, { color: colors.tabIconDefault }]}>{s.stats.weeklyGoal}</Text>
      <Card classicStyle={styles.goalCard} boxStyle={styles.goalBox} style={styles.goalOuter}>
        <Text style={[styles.goalValue, { color: colors.text }, g.brutal && styles.brutalValue]}>
          {s.stats.goalProgress(hours(usage.thisWeek), hours(weeklyGoal))}
        </Text>
        {g.brutal ? (
          <SegmentBar testID="stats-goal-bar" filled={segmentsFilled(goal.pct * 100, 8)} segments={8} />
        ) : (
        <View style={[styles.goalTrack, { backgroundColor: colors.background }]}>
          <View
            style={[
              styles.goalFill,
              { backgroundColor: goal.behind ? colors.tint : '#22C55E', width: `${Math.round(goal.pct * 100)}%` },
            ]}
          />
        </View>
        )}
        {/* a reached goal is the celebration, not a footnote, so it gets
            the trophy and the big type. */}
        {goal.behind ? (
          <Text style={[styles.goalStatus, { color: legibleOn('#EAB308', colors.card) }]}>{s.stats.goalBehind(hours(goal.remaining))}</Text>
        ) : (
          <>
            <Text style={styles.goalDoneEmoji}>🏆</Text>
            <Text variant="title" style={styles.goalDoneTitle}>{s.stats.goalReached}</Text>
          </>
        )}
      </Card>

      <Text style={[styles.sectionLabel, { color: colors.tabIconDefault }]}>{s.stats.last7Days}</Text>
      {!hasChartData ? (
        <Text style={[styles.noData, { color: colors.tabIconDefault }]}>{s.stats.noData}</Text>
      ) : (
        <Pressable style={styles.chart} onPress={() => setChartInMinutes(v => !v)}>
          {usage.last7Days.map(day => (
            <View key={day.date} style={styles.barColumn}>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.bar,
                    {
                      backgroundColor: colors.tint,
                      height: `${Math.max(4, Math.round((day.minutes / maxMinutes) * 100))}%`,
                    },
                    g.brutal && { backgroundColor: g.a, borderWidth: 2.5, borderColor: g.ink, borderRadius: 0 },
                  ]}
                />
              </View>
              <Text style={[styles.barValue, { color: colors.tabIconDefault }]}>
                {!chartInMinutes && day.minutes >= 60 ? `${hours(day.minutes)}h` : day.minutes}
              </Text>
              <Text style={[styles.barLabel, { color: colors.tabIconDefault }]}>{weekdayLabel(day.date)}</Text>
            </View>
          ))}
        </Pressable>
      )}

      <Text style={[styles.sectionLabel, { color: colors.tabIconDefault, marginTop: 24 }]}>
        {s.stats.learningProgress}
      </Text>
      <View style={styles.tileRow}>
        <Card fill="b" style={styles.tile} classicStyle={styles.tileClassic} boxStyle={styles.tileBox}>
          <Text style={[tileValueStyle(colors.accent), g.brutal && { color: g.onB }]}>{streak}</Text>
          <Text style={[styles.tileLabel, { color: colors.tabIconDefault }, g.brutal && { color: g.onB }]}>{s.done.streak}</Text>
        </Card>
        <Card style={styles.tile} classicStyle={styles.tileClassic} boxStyle={styles.tileBox}>
          <Text style={tileValueStyle(colors.accent)}>{known}</Text>
          <Text style={[styles.tileLabel, { color: colors.tabIconDefault }]}>{s.stats.known21}</Text>
        </Card>
      </View>
      <View style={styles.tileRow}>
        <Card style={styles.tile} classicStyle={styles.tileClassic} boxStyle={styles.tileBox}>
          <Text style={tileValueStyle(colors.accent)}>{graduated}</Text>
          <Text style={[styles.tileLabel, { color: colors.tabIconDefault }]}>{s.stats.graduatedLabel}</Text>
        </Card>
        <Card style={styles.tile} classicStyle={styles.tileClassic} boxStyle={styles.tileBox}>
          <Text style={tileValueStyle(colors.accent)}>{reviewsToday}</Text>
          <Text style={[styles.tileLabel, { color: colors.tabIconDefault }]}>{s.stats.reviewsToday}</Text>
        </Card>
      </View>

      {/* where the words went, how many wait now and how many sit in
          each distance bucket, plus the moment the queue next refills. */}
      <Text style={[styles.sectionLabel, { color: colors.tabIconDefault, marginTop: 24 }]}>
        {s.stats.schedule}
      </Text>
      {schedule.dueNow === 0 && schedule.scheduled === 0 ? (
        <Text style={[styles.noData, { color: colors.tabIconDefault }]}>{s.stats.scheduleEmpty}</Text>
      ) : (
        <Card classicStyle={styles.scheduleCard} style={styles.scheduleOuter}>
          <View style={styles.scheduleRow}>
            <Text style={[styles.scheduleLabel, { color: colors.text }]}>{s.stats.scheduleDueNow}</Text>
            <Text style={[styles.scheduleValue, { color: colors.tint }]}>
              {s.stats.scheduleWords(schedule.dueNow)}
            </Text>
          </View>
          {schedule.buckets.map(bucket => (
            <View key={bucket.key} style={styles.scheduleRow}>
              <Text style={[styles.scheduleLabel, { color: colors.tabIconDefault }]}>
                {bucketLabel[bucket.key]}
              </Text>
              <Text style={[styles.scheduleValue, { color: colors.text }]}>
                {s.stats.scheduleWords(bucket.count)}
              </Text>
            </View>
          ))}
          <Text style={[styles.scheduleFooter, { color: colors.tabIconDefault }]}>
            {s.stats.scheduleWaiting(schedule.scheduled)}
            {schedule.nextDue ? ` · ${s.stats.scheduleNext(nextRefreshLabel(schedule.nextDue))}` : ''}
          </Text>
        </Card>
      )}
      </ScrollView>

      {/* the button floats OUTSIDE the ScrollView, as on the settings tab, not
          stuck to the bottom of the list. */}
      <FeedbackButton level="-" languagePair="-" currentCard="stats-tab" draggable />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingTop: 40,
    paddingBottom: 60,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20,
  },
  tileRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  tile: {
    flex: 1,
  },
  tileClassic: {
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  // inside of the brutalist box.
  tileBox: { paddingVertical: 14, paddingHorizontal: 12, alignItems: 'center' },
  gapBottom: { marginBottom: 20 },
  goalOuter: { marginBottom: 24 },
  scheduleOuter: { marginBottom: 12 },
  goalBox: { padding: 16, gap: 10 },
  // The last card also scrolls out from under the chat button (FAB).
  brutalContent: { paddingBottom: 100 },
  brutalTitle: { textTransform: 'uppercase', fontWeight: '500' },
  brutalValue: { fontWeight: '500' },
  brutalBadgeText: { fontSize: 14 },
  tileValue: {
    fontSize: 26,
    fontWeight: '800',
  },
  tileLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  // level badge + known/total card.
  levelCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  levelCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  levelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  levelBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  levelCardValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  levelCardPair: {
    fontSize: 13,
    marginTop: 6,
  },
  // the known count of the other 3 PCIC levels, under the pair row.
  levelCardOthers: {
    fontSize: 12,
    marginTop: 8,
  },
  bestDayRow: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  bestDayValue: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  // weekly-goal card, value + progress bar + behind/reached status.
  goalCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 10,
  },
  goalValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  goalTrack: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  goalFill: {
    height: '100%',
    borderRadius: 5,
  },
  goalDoneEmoji: { fontSize: 48, textAlign: 'center', marginTop: 4 },
  goalDoneTitle: { fontSize: 24, fontWeight: '800', color: '#22C55E', textAlign: 'center' },
  goalStatus: {
    fontSize: 13,
    fontWeight: '600',
  },
  noData: {
    fontSize: 14,
    marginBottom: 20,
  },
  // schedule card, one row per distance bucket + a footer summary.
  scheduleCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 8,
  },
  scheduleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scheduleLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  scheduleValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  scheduleFooter: {
    fontSize: 12,
    marginTop: 4,
  },
  chart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 140,
    marginBottom: 20,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
  },
  barTrack: {
    width: 18,
    height: 90,
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: 6,
    minHeight: 4,
  },
  barValue: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  barLabel: {
    fontSize: 11,
    marginTop: 2,
  },
});
