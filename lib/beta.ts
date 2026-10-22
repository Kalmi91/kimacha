// Beta switches (spec HAROM-JATEK.md, building rule): every new feature ships behind one, off by
// default; off = the old behavior, unchanged. Stored app-wide in user_meta.beta_flags (the DB
// methods getBetaFlags / setBetaFlag), cached here so the hook and the plain reader are synchronous.
//
//   useBeta(flag)       hook, re-renders when the flag changes (Settings -> Beta)
//   getBeta(flag)       plain synchronous reader (false until loadBeta() has finished)
//   loadBeta()          reads the flags from the DB once; useBeta calls it, so the tab layout loads it at startup
//   setBeta(flag, on)   saves + notifies

import { useEffect, useMemo, useSyncExternalStore } from 'react';

import { getDb } from '@/lib/database';

export type BetaFlag = 'practiceTab' | 'sentenceTab' | 'xpV2' | 'levels' | 'practiceDictation' | 'practiceScramble' | 'practiceMatch' | 'practiceOpposites' | 'sentenceListening' | 'sentenceMistakes' | 'sentenceHint';

export const BETA_FLAGS: readonly BetaFlag[] = ['practiceTab', 'sentenceTab', 'xpV2', 'levels', 'practiceDictation', 'practiceScramble', 'practiceMatch', 'practiceOpposites', 'sentenceListening', 'sentenceMistakes', 'sentenceHint'];

export const BETA_DEFAULTS: Readonly<Record<BetaFlag, boolean>> = {
  practiceTab: false,
  sentenceTab: false,
  xpV2: false,
  levels: false,
  // the Practice tab games are on from the start (Kálmán, 2026-10-21); the switch hides one.
  practiceDictation: true,
  practiceScramble: true,
  practiceMatch: true,
  practiceOpposites: true,
  // New flags from sentenceListening on ship ON by default (Kálmán 3a); the older ones above stay off.
  sentenceListening: true,
  sentenceMistakes: true,
  sentenceHint: true,
};

let flags: Record<BetaFlag, boolean> = { ...BETA_DEFAULTS };
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
const emit = () => listeners.forEach((fn) => fn());

export function getBeta(flag: BetaFlag): boolean {
  return flags[flag];
}

// Once per app run; a DB error leaves every flag at its default (off) rather than breaking the app.
export function loadBeta(): Promise<void> {
  loading ??= getDb()
    .getBetaFlags()
    .then((stored) => {
      const next = { ...BETA_DEFAULTS };
      let changed = false;
      for (const flag of BETA_FLAGS) {
        if (typeof stored[flag] === 'boolean') next[flag] = stored[flag];
        if (next[flag] !== flags[flag]) changed = true;
      }
      if (changed) {
        flags = next;
        emit();
      }
    })
    .catch(() => {
      // a DB error leaves every flag at its default (see above)
    });
  return loading;
}

export async function setBeta(flag: BetaFlag, on: boolean): Promise<void> {
  await loadBeta();
  if (flags[flag] === on) return;
  flags = { ...flags, [flag]: on };
  emit();
  await getDb().setBetaFlag(flag, on);
}

export function useBeta(flag: BetaFlag): boolean {
  useEffect(() => {
    void loadBeta();
  }, []);
  return useSyncExternalStore(subscribe, () => flags[flag], () => BETA_DEFAULTS[flag]);
}

// Which of `list` are on right now, in the order of `list`; re-renders when one changes (the Practice tab's mode chips).
export function useBetaEnabled(list: readonly BetaFlag[]): BetaFlag[] {
  useEffect(() => {
    void loadBeta();
  }, []);
  const key = useSyncExternalStore(
    subscribe,
    () => list.filter((f) => flags[f]).join(','),
    () => list.filter((f) => BETA_DEFAULTS[f]).join(','),
  );
  return useMemo(() => (key ? (key.split(',') as BetaFlag[]) : []), [key]);
}

// Test helper (same pattern as __setLevelForTest in database.web.ts): forget the cache so the next load re-reads the DB.
export function __resetBetaForTest(): void {
  flags = { ...BETA_DEFAULTS };
  loading = null;
}
