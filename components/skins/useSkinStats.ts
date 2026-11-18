import { useEffect, useState } from 'react';

import { getDb } from '@/lib/database';

// the real data for the gamer (LVL) decor. Refreshed on load and
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
        .catch(() => {
          // a failed read keeps the last value; the next poll tries again
        });
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

const loadMinutes = async () => (await getDb().getUsageStats()).allTimeTotal;

// All active learning minutes (the gamer's XP is computed from this).
export function useActiveMinutes(): number {
  return usePolled(loadMinutes);
}
