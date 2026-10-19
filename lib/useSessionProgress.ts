import { useCallback } from 'react';

import { getDb } from '@/lib/database';

/**
 * The one path for a screen's `game_progress` row writes (the grammar lesson rows, the table-deck rows).
 * Fire-and-forget: the screen keeps its own state, and a failed save must not break it, so the rejection
 * is swallowed here once instead of with a `.catch(() => {})` at every call site. The database is read at
 * call time, not captured.
 */
export function useSessionProgress() {
  const persistRow = useCallback((gameId: string, itemId: string, state: string, data?: unknown) => {
    getDb()
      .setGameProgress(gameId, itemId, state, data)
      .catch(() => {
        // see the comment above
      });
  }, []);
  return { persistRow };
}
