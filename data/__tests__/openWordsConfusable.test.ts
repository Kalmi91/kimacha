// az összetéveszthető csoportok (scripts/words-open-confusable.json, pl. while/when:
// mientras, cuando, cuándo) minden tagján van kis mondat (hint_en), és a Learn-kártya hozzáfér (PcicItem.hint).
// A scripts/words-open-check.mjs R15 ugyanezt őrzi, de a CI csak a jestet futtatja.
import confusable from '../../scripts/words-open-confusable.json';
import { findPcicItem, setPcicTarget } from '../pcic';

describe('data/words-open összetéveszthető csoportok (FB459)', () => {
  afterEach(() => setPcicTarget('es'));

  const sets = confusable.sets as { name: string; orders: number[] }[];

  it('minden halmaznak legalább 2 tagja van, és egy kártya csak egy halmazban szerepel', () => {
    expect(sets.length).toBeGreaterThan(0);
    for (const s of sets) expect(s.orders.length).toBeGreaterThanOrEqual(2);
    const all = sets.flatMap((s) => s.orders);
    expect(new Set(all).size).toBe(all.length);
  });

  it('minden tag létezik, és kis mondatot kap: pontosan egy *kiemelt* szóval', () => {
    setPcicTarget('es');
    const bad: string[] = [];
    for (const s of sets) {
      for (const o of s.orders) {
        const item = findPcicItem(`o${o}`);
        if (!item) bad.push(`${s.name}: o${o} nincs`);
        else if (!item.hint || !/^[^*]*\*[^*]+\*[^*]*$/.test(item.hint)) bad.push(`${s.name}: o${o} hint hibás: ${item.hint}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('a while (mientras) kártyán is van mondat, a when párjain is', () => {
    expect(findPcicItem('o167')?.hint).toBe('I read *while* you cook.');
    expect(findPcicItem('o166')?.hint).toContain('*when*');
    expect(findPcicItem('o161')?.hint).toContain('*When*');
  });
});
