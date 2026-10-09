// User feedback: "there should be something so that if we play at midnight
// with the game, and it exactly rolls over, it prints the daily stats and congratulates
// the player, with something really cool, be very creative, and write
// something really nice and let there be many different texts but let there be
// repetition too."
//
// Hence: a pool of celebration lines, picked at RANDOM (not round-robin), so
// lines do come back over time, exactly the repetition that was asked for.
// Pure module, the toast only renders what it gets back.

interface DayTotals {
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
