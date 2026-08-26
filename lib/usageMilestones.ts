// FB149, Kálmán 2026-08-20 (settings-tab): "1 óra után 15 percenként gratuláljon
// az app és. indig más szöveggel. legyen benne valami kreativitás".
//
// FB63 fired the daily celebration at 30 and 60 minutes and then went quiet for
// the rest of the day. Past the first hour the day's total keeps crossing a
// milestone every quarter hour, and those crossings get their own pool of lines
// (picked at random, so they come back over time like the FB108 midnight pool)
// instead of the single "{min} minutes today" template.

export const DAILY_MILESTONES = [30, 60];
export const LONG_HAUL_FROM = 60;
export const LONG_HAUL_EVERY = 15;

export function isDailyMilestone(minutes: number): boolean {
  if (DAILY_MILESTONES.includes(minutes)) return true;
  return isLongHaulMilestone(minutes);
}

// Past the first hour: 75, 90, 105, ... The hour itself stays a DAILY_MILESTONES
// crossing, so it keeps its own line and is never celebrated twice.
export function isLongHaulMilestone(minutes: number): boolean {
  return minutes > LONG_HAUL_FROM && minutes % LONG_HAUL_EVERY === 0;
}

export function pickMilestoneLine(
  variants: string[],
  minutes: number,
  random: number = Math.random()
): string {
  if (variants.length === 0) return '';
  const clamped = Math.min(0.999999, Math.max(0, random));
  const template = variants[Math.floor(clamped * variants.length)];
  return template.replace('{min}', String(minutes)).replace('{hours}', hoursLabel(minutes));
}

// "75 perc" reads worse than "1,25 óra" at this length, so the pool can ask for
// whole/half hours instead: 75 -> "1.25", 90 -> "1.5", 120 -> "2".
function hoursLabel(minutes: number): string {
  const hours = minutes / 60;
  return Number.isInteger(hours) ? String(hours) : String(Math.round(hours * 100) / 100);
}
