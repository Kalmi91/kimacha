// FB83: a colored band behind the system clock and battery, so they stay
// readable over the app background. Tapping the band cycles through five
// blues; the choice is stored as an index (user_meta.status_bar_tint).

export const STATUS_BAR_TINTS = [
  '#1D4ED8', // royal
  '#0EA5E9', // sky
  '#0F4C81', // deep navy
  '#38BDF8', // ice
  '#312E81', // indigo night
];

// Wraps around, and survives a stored index that no longer exists (list edits).
export function nextTintIndex(index: number): number {
  const safe = Number.isInteger(index) && index >= 0 && index < STATUS_BAR_TINTS.length ? index : 0;
  return (safe + 1) % STATUS_BAR_TINTS.length;
}

export function tintColor(index: number): string {
  return STATUS_BAR_TINTS[index] ?? STATUS_BAR_TINTS[0];
}
