// recordCorrectHalf (lib/practice/halfXp.ts): the XP of a correct practice answer, memory db.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));

import { getDb } from '@/lib/database';
import { __resetForTests } from '@/lib/dailyXp';
import { addDays, sm2NewCard, type Sm2Card } from '@/lib/sm2';
import { localDateString } from '@/lib/usageStats';
import { recordCorrectHalf } from '../halfXp';

const TODAY = localDateString();

const learned = (itemId: string, reps: number): Sm2Card => ({
  ...sm2NewCard(itemId),
  state: 'review',
  interval: 4,
  reps,
  due: addDays(TODAY, 3),
  lastReview: addDays(TODAY, -1),
  introducedAt: addDays(TODAY, -5),
});

describe('recordCorrectHalf', () => {
  const db = getDb();
  beforeEach(async () => {
    __resetForTests();
    await db.resetPcicCards();
    await db.addDailyXpTenths(TODAY, -100000);
  });

  it('switch off: the half is recorded, no XP', async () => {
    await db.upsertPcicCard(learned('w1', 2));
    expect(await recordCorrectHalf('w1', false)).toMatchObject({ halfSteps: 1, srs: 'none' });
    expect(await db.getDailyXpTenths(TODAY)).toBe(0);
  });

  it('switch on: a half is worth 1 XP, 0.2 from the 3rd repetition on (exact tenths)', async () => {
    await db.upsertPcicCard(learned('w2', 2));
    await recordCorrectHalf('w2', true);
    expect(await db.getDailyXpTenths(TODAY)).toBe(10);
    await db.upsertPcicCard(learned('w3', 3));
    await recordCorrectHalf('w3', true);
    expect(await db.getDailyXpTenths(TODAY)).toBe(12);
  });

  it('the second half moves the card, and still pays by the reps before that answer', async () => {
    await db.upsertPcicCard(learned('w4', 2));
    await recordCorrectHalf('w4', true);
    await recordCorrectHalf('w4', true);
    expect((await db.getPcicCard('w4'))?.reps).toBe(3);
    expect(await db.getDailyXpTenths(TODAY)).toBe(20);
  });

  it('a word with no card yet, or a still-new card: nothing recorded, no XP', async () => {
    expect(await recordCorrectHalf('nope', true)).toBeNull();
    await db.upsertPcicCard(sm2NewCard('fresh'));
    expect(await recordCorrectHalf('fresh', true)).toBeNull();
    expect(await db.getDailyXpTenths(TODAY)).toBe(0);
  });
});
