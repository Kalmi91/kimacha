import type { Level } from '@/data/words';

// Cross-tab one-shot signal: Settings tab sets an action, Learn tab consumes it
// on focus. A module singleton works because the JS context is shared across tabs.
export type PendingAction =
  | { type: 'restart' }
  | { type: 'exam'; examLevel: Level }
  | { type: 'setLevel'; level: Level }
  | { type: 'selectTopic' }
  // FB315 (NY9): a grammar-lecke "Ezen szavak tanulása" gombja; a payload a
  // focusWords singletonban van (lib/focusWords.ts), ez a jel csak a reload-ot kéri.
  | { type: 'focusWords' };

let pending: PendingAction | null = null;

export function setPendingAction(action: PendingAction) {
  pending = action;
}

export function consumePendingAction(): PendingAction | null {
  const p = pending;
  pending = null;
  return p;
}
