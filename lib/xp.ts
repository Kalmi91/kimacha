// Gamer: game level from the active learning minutes. 1 minute = 10 XP, 100 XP = 1 level
// (starts at LVL 1), the bar shows progress within the current level (0-99%).
const XP_PER_MINUTE = 10;
const XP_PER_LEVEL = 100;

export function xpFromMinutes(minutes: number): number {
  return Math.max(0, Math.floor(minutes)) * XP_PER_MINUTE;
}

export function xpLevel(minutes: number): { level: number; pct: number } {
  const xp = xpFromMinutes(minutes);
  return { level: Math.floor(xp / XP_PER_LEVEL) + 1, pct: Math.floor(((xp % XP_PER_LEVEL) / XP_PER_LEVEL) * 100) };
}
