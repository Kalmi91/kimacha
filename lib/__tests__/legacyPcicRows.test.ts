// The one-off cleanup of pcic_cards rows left over from the retired PCIC / Spanish word-list
// decks (lib/db/migrations.ts dropLegacyPcicRows), run in place of the old id-remap migrations.

import { dropLegacyPcicRows, isLegacyPcicId } from '../db/migrations';
import { PCIC_LEVELS, pcicItemsForLevel, setPcicTarget, getPcicTarget } from '@/data/pcic';

// A table of item ids behind the two SQL calls the migration makes.
function fakeDb(ids: string[]) {
  const rows = new Set(ids);
  const db: any = {
    getAllAsync: jest.fn(async () => [...rows].map((item_id) => ({ item_id }))),
    runAsync: jest.fn(async (_sql: string, params: string[]) => {
      for (const id of params) rows.delete(id);
      return {};
    }),
  };
  return { db, rows };
}

describe('dropLegacyPcicRows', () => {
  it('deletes the retired-deck rows, keeps the current o<n> / e<n> rows', async () => {
    const { db, rows } = fakeDb(['a1-0184', 'b2-9f3c2a10', 'a2-0bcfdca8', 'w123', 'o12', 'o600', 'e45', 'x1']);
    await dropLegacyPcicRows(db);
    expect([...rows].sort()).toEqual(['e45', 'o12', 'o600', 'x1']);
  });

  it('is idempotent: the second run deletes nothing', async () => {
    const { db, rows } = fakeDb(['a1-0184', 'o12']);
    await dropLegacyPcicRows(db);
    db.runAsync.mockClear();
    await dropLegacyPcicRows(db);
    expect(db.runAsync).not.toHaveBeenCalled();
    expect([...rows]).toEqual(['o12']);
  });

  it('does not touch the table when there is nothing to drop', async () => {
    const { db } = fakeDb(['o1', 'e2']);
    await dropLegacyPcicRows(db);
    expect(db.runAsync).not.toHaveBeenCalled();
  });

  it('deletes in chunks, a big leftover table is cleaned too', async () => {
    const ids = Array.from({ length: 1201 }, (_, i) => `a1-${i}`).concat(['o1']);
    const { db, rows } = fakeDb(ids);
    await dropLegacyPcicRows(db);
    expect(db.runAsync).toHaveBeenCalledTimes(3);
    expect([...rows]).toEqual(['o1']);
  });
});

describe('isLegacyPcicId', () => {
  it('matches no id of the current decks (both directions)', () => {
    const before = getPcicTarget();
    try {
      for (const target of ['es', 'en'] as const) {
        setPcicTarget(target);
        let seen = 0;
        for (const level of PCIC_LEVELS) {
          for (const item of pcicItemsForLevel(level)) {
            seen++;
            expect(isLegacyPcicId(item.id)).toBe(false);
          }
        }
        expect(seen).toBeGreaterThan(0);
      }
    } finally {
      setPcicTarget(before);
    }
  });
});
