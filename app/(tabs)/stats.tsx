import { useCallback, useState } from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { getDb } from '@/lib/database';
import { t } from '@/lib/i18n';
import {
  weeklyGoalProgress,
  DEFAULT_WEEKLY_GOAL_MINUTES,
  type UsageStats,
} from '@/lib/usageStats';
import FeedbackButton from '@/components/FeedbackModal';

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
  const [usage, setUsage] = useState<UsageStats>(EMPTY_STATS);
  const [streak, setStreak] = useState(0);
  const [mastered, setMastered] = useState(0);
  const [reviewsToday, setReviewsToday] = useState(0);
  const [weeklyGoal, setWeeklyGoal] = useState(DEFAULT_WEEKLY_GOAL_MINUTES);

  // Refresh every time the tab gains focus (mirrors the Settings tab's
  // spellingDue pattern), so numbers stay current across app-wide activity.
  useFocusEffect(
    useCallback(() => {
      const db = getDb();
      db.getUsageStats().then(setUsage);
      db.getStreak().then(r => setStreak(r.current_count));
      db.getMasteredCount().then(setMastered);
      db.getTodayStats().then(r => setReviewsToday(r.totalReviews));
      db.getWeeklyGoalMinutes().then(setWeeklyGoal);
    }, [])
  );

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
  const weekdayLabel = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: colors.text }]}>{s.stats.title}</Text>

      <View style={styles.tileRow}>
        <View style={[styles.tile, { backgroundColor: colors.card }]}>
          <Text style={[styles.tileValue, { color: colors.tint }]}>{usage.today}</Text>
          <Text style={[styles.tileLabel, { color: colors.tabIconDefault }]}>{s.stats.today}</Text>
        </View>
        <View style={[styles.tile, { backgroundColor: colors.card }]}>
          <Text style={[styles.tileValue, { color: colors.tint }]}>{usage.thisWeek}</Text>
          <Text style={[styles.tileLabel, { color: colors.tabIconDefault }]}>{s.stats.thisWeek}</Text>
        </View>
      </View>
      <View style={styles.tileRow}>
        <View style={[styles.tile, { backgroundColor: colors.card }]}>
          <Text style={[styles.tileValue, { color: colors.tint }]}>{usage.allTimeTotal}</Text>
          <Text style={[styles.tileLabel, { color: colors.tabIconDefault }]}>{s.stats.allTime}</Text>
        </View>
        <View style={[styles.tile, { backgroundColor: colors.card }]}>
          <Text style={[styles.tileValue, { color: colors.tint }]}>{usage.daysActive}</Text>
          <Text style={[styles.tileLabel, { color: colors.tabIconDefault }]}>{s.stats.daysActive}</Text>
        </View>
      </View>

      {usage.bestDay && (
        <View style={[styles.bestDayRow, { backgroundColor: colors.card }]}>
          <Text style={[styles.tileLabel, { color: colors.tabIconDefault }]}>{s.stats.bestDay}</Text>
          <Text style={[styles.bestDayValue, { color: colors.text }]}>
            {usage.bestDay.date} · {s.stats.minutes(usage.bestDay.minutes)}
          </Text>
        </View>
      )}

      {/* FB65: weekly goal, the rolling 7-day total measured against the target
          set in Settings, with an explicit warning while it's still short. */}
      <Text style={[styles.sectionLabel, { color: colors.tabIconDefault }]}>{s.stats.weeklyGoal}</Text>
      <View style={[styles.goalCard, { backgroundColor: colors.card }]}>
        <Text style={[styles.goalValue, { color: colors.text }]}>
          {s.stats.goalProgress(hours(usage.thisWeek), hours(weeklyGoal))}
        </Text>
        <View style={[styles.goalTrack, { backgroundColor: colors.background }]}>
          <View
            style={[
              styles.goalFill,
              { backgroundColor: goal.behind ? colors.tint : '#22C55E', width: `${Math.round(goal.pct * 100)}%` },
            ]}
          />
        </View>
        <Text style={[styles.goalStatus, { color: goal.behind ? '#EAB308' : '#22C55E' }]}>
          {goal.behind ? s.stats.goalBehind(hours(goal.remaining)) : s.stats.goalReached}
        </Text>
      </View>

      <Text style={[styles.sectionLabel, { color: colors.tabIconDefault }]}>{s.stats.last7Days}</Text>
      {!hasChartData ? (
        <Text style={[styles.noData, { color: colors.tabIconDefault }]}>{s.stats.noData}</Text>
      ) : (
        <View style={styles.chart}>
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
                  ]}
                />
              </View>
              <Text style={[styles.barValue, { color: colors.tabIconDefault }]}>{day.minutes}</Text>
              <Text style={[styles.barLabel, { color: colors.tabIconDefault }]}>{weekdayLabel(day.date)}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={[styles.sectionLabel, { color: colors.tabIconDefault, marginTop: 24 }]}>
        {s.stats.learningProgress}
      </Text>
      <View style={styles.tileRow}>
        <View style={[styles.tile, { backgroundColor: colors.card }]}>
          <Text style={[styles.tileValue, { color: colors.accent }]}>{streak}</Text>
          <Text style={[styles.tileLabel, { color: colors.tabIconDefault }]}>{s.done.streak}</Text>
        </View>
        <View style={[styles.tile, { backgroundColor: colors.card }]}>
          <Text style={[styles.tileValue, { color: colors.accent }]}>{mastered}</Text>
          <Text style={[styles.tileLabel, { color: colors.tabIconDefault }]}>{s.stats.wordsMastered}</Text>
        </View>
      </View>
      <View style={styles.tileRow}>
        <View style={[styles.tile, { backgroundColor: colors.card }]}>
          <Text style={[styles.tileValue, { color: colors.accent }]}>{reviewsToday}</Text>
          <Text style={[styles.tileLabel, { color: colors.tabIconDefault }]}>{s.stats.reviewsToday}</Text>
        </View>
      </View>

      <FeedbackButton level="-" languagePair="-" currentCard="stats-tab" />
    </ScrollView>
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
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
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
  // FB65: weekly-goal card, value + progress bar + behind/reached status.
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
  goalStatus: {
    fontSize: 13,
    fontWeight: '600',
  },
  noData: {
    fontSize: 14,
    marginBottom: 20,
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
