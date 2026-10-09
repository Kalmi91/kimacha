// Szocreal "Daily plan n%": today's active minutes relative to one seventh of the weekly goal,
// in whole percent. The value can exceed 100 (the bar stops at 100, the label does not).
export function dailyPlanPercent(todayMinutes: number, weeklyGoalMinutes: number): number {
  if (weeklyGoalMinutes <= 0 || todayMinutes <= 0) return 0;
  return Math.round((todayMinutes / (weeklyGoalMinutes / 7)) * 100);
}
