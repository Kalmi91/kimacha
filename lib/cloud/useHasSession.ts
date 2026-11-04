import { useSyncExternalStore } from 'react';

import { loadSession, subscribeSession } from './session';

// True while a cloud session is stored; re-renders when one is saved or cleared (login, logout).
export function useHasSession(): boolean {
  return useSyncExternalStore(subscribeSession, () => loadSession() !== null);
}
