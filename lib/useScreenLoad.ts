import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSingleFlight } from '@/lib/useSingleFlight';

interface ScreenLoadOptions {
  /**
   * The screen already shows data from an earlier load: the refocus then refreshes it quietly, without
   * flipping `setLoading(true)` (no spinner flash over a screen that has its content).
   */
  hasData?: boolean;
  /** Raises the screen's loading state; the loader itself clears it when it is done. Must be a stable function. */
  setLoading?: (loading: boolean) => void;
  /** Runs when the screen loses focus (e.g. stops the read-aloud). */
  onBlur?: () => void;
}

/**
 * Runs a screen's loader every time the screen gains focus, and not twice at once: a focus that arrives
 * while the loader (same identity) is still running does not start a second run.
 *
 * Replaces the per-screen `useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]))`.
 * The React Compiler reads the setState-after-await in the loaders as a cascading render when the effect
 * is written out in the screen, so it lives here once (same reason as lib/useLoadOnMount.ts).
 */
export function useScreenLoad(load: () => unknown, { hasData = false, setLoading, onBlur }: ScreenLoadOptions = {}) {
  const runOnce = useSingleFlight();
  // Read inside the focus callback: as dependencies they would re-run the load whenever the data or the handler changes.
  const hasDataRef = useRef(hasData);
  const onBlurRef = useRef(onBlur);
  useEffect(() => {
    hasDataRef.current = hasData;
    onBlurRef.current = onBlur;
  });

  useFocusEffect(
    useCallback(() => {
      void runOnce(async () => {
        if (!hasDataRef.current) setLoading?.(true);
        await load();
      }, load);
      return () => onBlurRef.current?.();
    }, [load, runOnce, setLoading]),
  );
}
