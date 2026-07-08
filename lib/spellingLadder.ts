/**
 * FB39: spacing-repetition ladder for the spelling-practice list.
 *
 * Fixed steps 1, 3, 4, 8, 16, 32 days (the user's own numbers), then doubling
 * beyond that (64, 128, ...) so a mastered word keeps drifting further out.
 */
const FIXED_STEPS = [1, 3, 4, 8, 16, 32];

export function spellingLadderDays(step: number): number {
  if (step < FIXED_STEPS.length) return FIXED_STEPS[step];
  const extra = step - (FIXED_STEPS.length - 1);
  return FIXED_STEPS[FIXED_STEPS.length - 1] * Math.pow(2, extra);
}
