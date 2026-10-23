import { useCallback, useState } from 'react';
import { getDb } from '@/lib/database';
import { useLearner } from '@/lib/learner';
import { useBeta } from '@/lib/beta';
import {
  weeklyGoalProgress,
  DEFAULT_WEEKLY_GOAL_MINUTES,
  localDateString,
  type UsageStats,
} from '@/lib/usageStats';
import { buildSchedulePreview, type SchedulePreview } from '@/lib/schedulePreview';
import { PCIC_VIEW_LEVELS, pcicItemsForLevel, type PcicLevel } from '@/data/pcic';
import { cardsForLevel } from '@/lib/pcicLevels';
import { countKnown, countGraduated, countLearned } from '@/lib/pcicStats';
import { countDoneToday } from '@/lib/pcicSession';
import { mockAvailable, MOCK_LEVELS } from '@/lib/exam/mock/blueprint';
import { readMockOverview, type MockOverview } from '@/lib/exam/mock/session';
import type { MockLevel, MockTarget } from '@/lib/exam/mock/types';
import type { ProgressLevel } from '@/lib/progressLevel';
import { readProgressLevel } from '@/lib/progressLevelDb';
import { useScreenLoad } from '@/lib/useScreenLoad';

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

// The Stats tab's state and its focus-time load. The screen (app/(tabs)/stats.tsx) renders it.
// The practice-exam levels that have content: a level whose papers are not written yet is not offered (it would be a dead end).
const availableMockLevels = (target: MockTarget): readonly MockLevel[] => MOCK_LEVELS[target].filter((level) => mockAvailable(target, level));

export function useStatsScreen() {
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
  const [mockLevels, setMockLevels] = useState<readonly MockLevel[]>(() => availableMockLevels('es'));
  const [mockOverview, setMockOverview] = useState<MockOverview>({});
  const [mockOfficial, setMockOfficial] = useState(true);
  // The learner's level A1-C1 (lib/progressLevel.ts); read only while the card is shown.
  const [progressLevel, setProgressLevel] = useState<ProgressLevel | null>(null);
  // The daily bar is shown in hours above 60 minutes, and switches to minutes on tap.
  const [chartInMinutes, setChartInMinutes] = useState(false);

  // beta: levels, the level card (Settings -> Beta); off = no card and no level data read.
  const showLevels = useBeta('levels');
  const { refresh } = useLearner();

  // Refresh every time the tab gains focus so numbers stay current across app-wide activity.
  const load = useCallback(() => {
    const db = getDb();
    return Promise.all([
      db.getUsageStats().then(setUsage),
      db.getStreak().then(r => setStreak(r.current_count)),
      db.getWeeklyGoalMinutes().then(setWeeklyGoal),
      refresh(['direction']).then(ob => {
        setTargetLang(ob.target);
        setSourceLang(ob.source ?? 'en');
        // Target hu has no practice exam (no mock card) and no level card.
        if (ob.target === 'hu') {
          setMockLevels([]);
          setMockOfficial(false);
          setMockOverview({});
          setProgressLevel(null);
          return undefined;
        }
        const mockTarget: MockTarget = ob.target === 'en' ? 'en' : 'es';
        setMockLevels(availableMockLevels(mockTarget));
        setMockOfficial(mockTarget === 'es');
        return Promise.all([
          readMockOverview(db, mockTarget, MOCK_LEVELS[mockTarget]).then(setMockOverview),
          showLevels ? readProgressLevel(db, mockTarget).then(setProgressLevel) : undefined,
        ]);
      }),
      // All PCIC computation comes from a single getPcicCards()
      // call (as on the PCIC tab); the filtering/aggregation is in pure functions.
      refresh(['level']).then(async ({ level: lvl }) => {
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
      }),
    ]);
  }, [showLevels, refresh]);
  useScreenLoad(load);

  const maxMinutes = Math.max(1, ...usage.last7Days.map(d => d.minutes));
  const hasChartData = usage.last7Days.some(d => d.minutes > 0);
  const goal = weeklyGoalProgress(usage.thisWeek, weeklyGoal);

  return {
    usage,
    streak,
    known,
    graduated,
    reviewsToday,
    weeklyGoal,
    schedule,
    pcicLevel,
    levelKnown,
    levelTotal,
    otherLevels,
    targetLang,
    sourceLang,
    mockLevels,
    mockOverview,
    mockOfficial,
    progressLevel,
    showLevels,
    chartInMinutes,
    setChartInMinutes,
    maxMinutes,
    hasChartData,
    goal,
  };
}
