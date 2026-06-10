import type { Level } from '@/data/words';

// Cross-tab one-shot signal: Settings tab sets an action, Learn tab consumes it
// on focus. A module singleton works because the JS context is shared across tabs.
export type PendingAction =
  | { type: 'restart' }
  | { type: 'exam'; examLevel: Level }
  | { type: 'setLevel'; level: Level };

let pending: PendingAction | null = null;

export function setPendingAction(action: PendingAction) {
  pending = action;
}

export function consumePendingAction(): PendingAction | null {
  const p = pending;
  pending = null;
  return p;
}
