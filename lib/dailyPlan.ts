// PLAN-temak 4D (szocreal, "Napi terv n%"): a mai aktív percek a heti cél napi egy hetedéhez
// képest, egész százalékban. Az érték 100 fölé is mehet (a sáv 100-nál megáll, a felirat nem).
export function dailyPlanPercent(todayMinutes: number, weeklyGoalMinutes: number): number {
  if (weeklyGoalMinutes <= 0 || todayMinutes <= 0) return 0;
  return Math.round((todayMinutes / (weeklyGoalMinutes / 7)) * 100);
}
