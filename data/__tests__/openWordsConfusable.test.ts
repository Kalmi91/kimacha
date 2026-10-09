// every member of the confusable groups (scripts/words-open-confusable.json, e.g. while/when:
// mientras, cuando, cuándo) has a short sentence (hint_en), and the Learn card gives access to it (PcicItem.hint).
// R15 of scripts/words-open-check.mjs guards the same, but CI runs only jest.
import confusable from '../../scripts/words-open-confusable.json';
import { findPcicItem, setPcicTarget } from '../pcic';

describe('data/words-open confusable groups', () => {
  afterEach(() => setPcicTarget('es'));

  const sets = confusable.sets as { name: string; orders: number[] }[];

  it('every set has at least 2 members, and a card appears in only one set', () => {
    expect(sets.length).toBeGreaterThan(0);
    for (const s of sets) expect(s.orders.length).toBeGreaterThanOrEqual(2);
    const all = sets.flatMap((s) => s.orders);
    expect(new Set(all).size).toBe(all.length);
  });

  it('every member exists, and gets a short sentence: with exactly one *highlighted* word', () => {
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

  it('the while (mientras) card has a sentence too, and so do its when counterparts', () => {
    expect(findPcicItem('o167')?.hint).toBe('I read *while* you cook.');
    expect(findPcicItem('o166')?.hint).toContain('*when*');
    expect(findPcicItem('o161')?.hint).toContain('*When*');
  });
});
