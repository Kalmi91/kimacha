import { useEffect, useState } from 'react';
import { getXp, onXpChanged, wholeXp } from './dailyXp';
import { localDateString } from './usageStats';

// Today's whole XP for the chip on the grammar and Sentences screens; reads again after every addXp.
export function useXpToday(): number {
  const [xp, setXp] = useState(0);
  useEffect(() => {
    let alive = true;
    const read = () => {
      const day = localDateString();
      getXp(day).then(
        (d) => alive && setXp(wholeXp(d.xp)),
        () => {
          // a failed read leaves the chip as it was
        },
      );
    };
    read();
    const off = onXpChanged(read);
    return () => {
      alive = false;
      off();
    };
  }, []);
  return xp;
}
