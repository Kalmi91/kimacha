// FB108, Kálmán 2026-08-08: "legyen olyan, hogy ha éjfélkor játszunk a
// játékkal, és pont átfordul akkor a napi statot írja ki és gratuláljon, a
// játékosnak, valami nagyon menő szöveggel, legyen nagyon kreatív, és irjaon
// valami nagyon szépet és sok különböző szöveg legyen de legyen benne
// ismétlödes is."
//
// Hence: a pool of celebration lines, picked at RANDOM (not round-robin), so
// lines do come back over time, exactly the repetition that was asked for.
// Pure module, the toast only renders what it gets back.

export interface DayTotals {
  minutes: number;
  words: number;
}

export function pickDayRolloverMessage(
  variants: string[],
  totals: DayTotals,
  random: number = Math.random()
): string {
  if (variants.length === 0) return '';
  const clamped = Math.min(0.999999, Math.max(0, random));
  const template = variants[Math.floor(clamped * variants.length)];
  return template.replace('{min}', String(totals.minutes)).replace('{words}', String(totals.words));
}
