import { useCallback, useRef } from 'react';

// The default key: every run() without a key of its own shares one slot.
const SHARED = Symbol('single-flight');

/**
 * Re-entry guard: `run(task)` starts the task unless a run with the same key is still in flight, in
 * which case it does nothing and resolves to undefined. The slot is released when the task settles,
 * also when it throws (the error still reaches the caller).
 *
 * `key` (optional) tells which runs count as the same one: a loader whose identity changed (new
 * screen params) passes itself as the key, so it is not swallowed by the run for the old params.
 */
export function useSingleFlight() {
  const running = useRef<{ key: unknown } | null>(null);
  return useCallback(async <T>(task: () => Promise<T> | T, key: unknown = SHARED): Promise<T | undefined> => {
    if (running.current?.key === key) return undefined;
    const mine = { key };
    running.current = mine;
    try {
      return await task();
    } finally {
      if (running.current === mine) running.current = null;
    }
  }, []);
}
