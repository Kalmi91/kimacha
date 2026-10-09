import { useEffect, useState } from 'react';

import { getDb } from '@/lib/database';

// the real data for the y2k (streak chip) and gamer (LVL / combo) decors. Refreshed on load and
// every half minute (like the socialist realism "Daily plan" bar); on error it stays 0.
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

// The daily streak (number of consecutive days).
export function useStreakCount(): number {
  return usePolled(loadStreak);
}

// All active learning minutes (the gamer's XP is computed from this).
export function useActiveMinutes(): number {
  return usePolled(loadMinutes);
}
