// The midnight toast's "{words}" on the memory DB: the number of PCIC words
// first introduced on that local day (introducedAt === day, the same rule as
// the daily new-word limit), not a count of the long-dead card_attempts table.

import { getDb } from '../database.web';
import { addDays, sm2NewCard } from '../sm2';
import { localDateString } from '../usageStats';

describe('getDayStats (memory db)', () => {
  const db = getDb();
  const today = localDateString();
  const yesterday = addDays(today, -1);

  it('counts the words introduced on the given day', async () => {
    const card = (id: string, introducedAt: string | null) => ({
      ...sm2NewCard(id),
      state: introducedAt ? ('learning' as const) : ('new' as const),
      introducedAt,
    });
    await db.upsertPcicCard(card('b1-0001', yesterday));
    await db.upsertPcicCard(card('b1-0002', yesterday));
    await db.upsertPcicCard(card('b1-0003', yesterday));
    await db.upsertPcicCard(card('b1-0004', today));
    await db.upsertPcicCard(card('b1-0005', null));
    // a word drilled again later keeps its introduction day
    await db.upsertPcicCard({ ...card('b1-0001', yesterday), state: 'review', interval: 1, reps: 3 });

    expect((await db.getDayStats(yesterday)).words).toBe(3);
    expect((await db.getDayStats(today)).words).toBe(1);
    expect((await db.getDayStats(addDays(today, -5))).words).toBe(0);
  });

  it('reports the usage minutes of the same day next to the words', async () => {
    await db.addUsageMinute();
    await db.addUsageMinute();
    expect(await db.getDayStats(today)).toEqual({ minutes: 2, words: 1 });
    expect(await db.getDayStats(yesterday)).toEqual({ minutes: 0, words: 3 });
  });
});
