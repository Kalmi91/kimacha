// GAMES.md 3. (F0): the shared in-round state every game needs, score, lives,
// combo, elapsed time, a pause/resume pair (K2 DÖNTÉS: the gloss bubble pauses
// the clock while it's open) and a hit/miss log for GameOverCard + scoring.ts.
//
// A game screen owns one `useGameSession()` and threads it through:
// GameShell gets {score, lives, elapsedMs, paused} for the header, and
// `session.pause`/`session.resume` go to GlossText's onOpenGloss/onCloseGloss
// so the timer stops exactly while the meaning bubble is open.

import { useCallback, useEffect, useRef, useState } from 'react';

export interface GameAttemptLog {
  wordId: number;
  correct: boolean;
  atMs: number;
}

export interface GameSessionOptions {
  // 0 = no lives (untimed/no-fail games like memory-pairs, myth, story).
  startLives?: number;
  tickMs?: number; // clock resolution, default 100ms
  onLivesDepleted?: () => void; // fires once, when lives hits 0
}

export interface GameSessionState {
  score: number;
  lives: number;
  combo: number;
  elapsedMs: number;
  paused: boolean;
  over: boolean;
  attempts: GameAttemptLog[];
}

export interface GameSessionApi extends GameSessionState {
  addScore: (points: number) => void;
  loseLife: () => void;
  bumpCombo: () => void;
  resetCombo: () => void;
  recordAttempt: (wordId: number, correct: boolean) => void;
  pause: () => void;
  resume: () => void;
  end: () => void;
  reset: () => void;
}

export function useGameSession(opts: GameSessionOptions = {}): GameSessionApi {
  const startLives = opts.startLives ?? 3;
  const tickMs = opts.tickMs ?? 100;

  const onLivesDepletedRef = useRef(opts.onLivesDepleted);
  onLivesDepletedRef.current = opts.onLivesDepleted;

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(startLives);
  const [combo, setCombo] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [attempts, setAttempts] = useState<GameAttemptLog[]>([]);

  useEffect(() => {
    if (paused || over) return;
    const id = setInterval(() => setElapsedMs((v) => v + tickMs), tickMs);
    return () => clearInterval(id);
  }, [paused, over, tickMs]);

  const addScore = useCallback((points: number) => setScore((v) => v + points), []);

  const loseLife = useCallback(() => {
    setLives((v) => {
      const next = Math.max(0, v - 1);
      if (next === 0 && startLives > 0) {
        setOver(true);
        onLivesDepletedRef.current?.();
      }
      return next;
    });
  }, [startLives]);

  const bumpCombo = useCallback(() => setCombo((v) => v + 1), []);
  const resetCombo = useCallback(() => setCombo(0), []);

  const recordAttempt = useCallback((wordId: number, correct: boolean) => {
    setAttempts((prev) => [...prev, { wordId, correct, atMs: Date.now() }]);
  }, []);

  const pause = useCallback(() => setPaused(true), []);
  const resume = useCallback(() => setPaused(false), []);
  const end = useCallback(() => setOver(true), []);

  const reset = useCallback(() => {
    setScore(0);
    setLives(startLives);
    setCombo(0);
    setElapsedMs(0);
    setPaused(false);
    setOver(false);
    setAttempts([]);
  }, [startLives]);

  return {
    score, lives, combo, elapsedMs, paused, over, attempts,
    addScore, loseLife, bumpCombo, resetCombo, recordAttempt, pause, resume, end, reset,
  };
}
