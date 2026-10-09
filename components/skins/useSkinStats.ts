import { useEffect, useState } from 'react';

import { getDb } from '@/lib/database';

// az y2k (streak-chip) és a gamer (LVL / kombó) díszek valós adatai. Betöltéskor és
// félpercenként frissülnek (mint a szocreál "Napi terv" sáv); hiba esetén marad a 0.
const REFRESH_MS = 30000;

function usePolled(load: () => Promise<number>): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let alive = true;
    const run = () => {
      load()
        .then((v) => {
          if (alive) setValue(v);
        })
        .catch(() => {});
    };
    run();
    const timer = setInterval(run, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [load]);
  return value;
}

const loadStreak = async () => (await getDb().getStreak())?.current_count ?? 0;
const loadMinutes = async () => (await getDb().getUsageStats()).allTimeTotal;

// A napi streak (egymást követő napok száma).
export function useStreakCount(): number {
  return usePolled(loadStreak);
}

// Az összes aktív tanulási perc (a gamer XP-je ebből számolódik).
export function useActiveMinutes(): number {
  return usePolled(loadMinutes);
}
