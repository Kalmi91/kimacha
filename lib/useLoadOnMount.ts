import { useEffect } from 'react';

/**
 * Runs a screen's loader when the screen mounts (and again if the loader
 * identity changes).
 *
 * The loaders it is given read the database first and only then set state, so
 * the state updates land after an await rather than synchronously inside the
 * effect. Written out at the call site the React Compiler reads that as a
 * cascading render, so the effect lives here once instead of in every screen.
 */
export function useLoadOnMount(load: () => void | Promise<unknown>) {
  useEffect(() => {
    load();
  }, [load]);
}
