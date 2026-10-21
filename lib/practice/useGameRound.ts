// The round of a Practice tab game on screen (shared by the games, see components/practice/modes.ts): loads it on every
// focus of the tab, resumes the saved one of the same day and direction or builds a new one from the learned words
// (lib/practice/gameRound.ts), keeps it saved after every update(), and stops the read-aloud on blur and on unmount.
// The mode only supplies GameLogic (its state at the start, and the check of a saved state).

import { useCallback, useEffect, useRef, useState } from 'react';

import { findPcicItem, type PcicTarget } from '@/data/pcic';
import { getDb } from '@/lib/database';
import { useLearner } from '@/lib/learner';
import { dropOrphanCards } from '@/lib/pcicSession';
import {
  loadSavedGame,
  pickGameWords,
  resumeGame,
  saveGame,
  startGame,
  toSaved,
  type GameLogic,
  type GameRound,
} from '@/lib/practice/gameRound';
import { stopSpeaking } from '@/lib/speech';
import { localDateString } from '@/lib/usageStats';
import { useScreenLoad } from '@/lib/useScreenLoad';

export interface UseGameRound<S> {
  /** false until the first load has finished. */
  loaded: boolean;
  /** null = no round (too few learned words): show the empty state. */
  round: GameRound<S> | null;
  target: PcicTarget;
  /** The Settings "Accents count" switch. */
  strictAccents: boolean;
  /** Replaces the mode's state and saves the round. */
  update: (next: S) => void;
  /** A new round of other words, even if one is on screen. */
  newRound: () => void;
}

export function useGameRound<S>(logic: GameLogic<S>): UseGameRound<S> {
  const { refresh, strictAccents } = useLearner();
  const [loaded, setLoaded] = useState(false);
  const [target, setTarget] = useState<PcicTarget>('es');
  const [round, setRound] = useState<GameRound<S> | null>(null);
  // The round on screen, for the focus effect and update() (the state is stale in a callback). shown null: nothing on screen.
  const current = useRef<GameRound<S> | null>(null);

  // `fresh`: a new round even if one is on screen (the "New round" button).
  const load = useCallback(async (fresh = false) => {
    // The deck of the active direction has to be set before findPcicItem (same as the Learn tab).
    const { target: dir } = await refresh(['direction', 'strictAccents']);
    const today = localDateString();
    // A round on screen (running or finished) survives leaving the tab; a new day or another direction replaces it.
    const on = current.current;
    if (!fresh && on && on.date === today && on.target === dir) return;
    // the last saved round, also when it is replaced: its words go to the end of the new one
    const stored = await loadSavedGame(logic.mode);
    let next = fresh ? null : resumeGame(stored, logic, today, dir, findPcicItem);
    if (!next) {
      const cards = dropOrphanCards(await getDb().getPcicCards(), (id) => findPcicItem(id) !== undefined);
      const items = pickGameWords({
        cards,
        today,
        findItem: findPcicItem,
        avoid: stored && stored.target === dir && (fresh || stored.date !== today) ? new Set(stored.ids) : undefined,
      });
      next = items.length > 0 ? startGame(logic, items, today, dir) : null;
      // a new round is saved at once; no round (too few words) clears an old value.
      void saveGame(logic.mode, next ? toSaved(logic.mode, next) : null).catch(() => {
        // the round on screen keeps its own state; a failed save only loses the resume point
      });
    }
    current.current = next;
    setTarget(dir);
    setRound(next);
    setLoaded(true);
  }, [refresh, logic]);

  // Leaving the tab stops the read-aloud (the tab stays mounted).
  useScreenLoad(load, { onBlur: stopSpeaking });
  useEffect(() => () => stopSpeaking(), []);

  const update = useCallback((state: S) => {
    const on = current.current;
    if (!on) return;
    const next = { ...on, state };
    current.current = next;
    setRound(next);
    void saveGame(logic.mode, toSaved(logic.mode, next)).catch(() => {
      // the round on screen keeps its own state; a failed save only loses the resume point
    });
  }, [logic.mode]);

  const newRound = useCallback(() => {
    void load(true);
  }, [load]);

  return { loaded, round, target, strictAccents, update, newRound };
}
