// XP of the grammar, Sentences and speech sources (FB591, FB600, FB601, FB606): the table, the per-item-per-day count
// (it survives an app kill) and the one function that decides what a "hard" sentence is. Memory db.

import { exportWebState, getDb } from '../database.web';
import { getXp } from '../dailyXp';
import { PCIC_LEVELS } from '../../data/pcic';
import { XP_TABLE, awardXp, isHardSentence, xpForRepeat, type XpKind } from '../xpAward';

const DAY = '2031-03-01';

async function payouts(kind: XpKind, key: string, times: number, date = DAY): Promise<number[]> {
  const out: number[] = [];
  for (let i = 0; i < times; i++) out.push(await awardXp(kind, key, date));
  return out;
}

describe('the XP table', () => {
  it('grammar right answer: 2, then 0.5, then nothing', async () => {
    expect(await payouts('grammar', 'g1', 4)).toEqual([2, 0.5, 0, 0]);
  });

  it('level practice: 0.5, then nothing', async () => {
    expect(await payouts('levelPractice', 'p1', 3)).toEqual([0.5, 0, 0]);
  });

  it('level test: 0.5, then nothing (FB624)', async () => {
    expect(await payouts('levelTest', 'lt1', 3)).toEqual([0.5, 0, 0]);
  });

  it('Sentences right answer: 1, then nothing', async () => {
    expect(await payouts('sentence', 's1', 3)).toEqual([1, 0, 0]);
  });

  it('Sentences hard sentence: 2, then nothing', async () => {
    expect(await payouts('sentenceHard', 'h1', 3)).toEqual([2, 0, 0]);
  });

  it('speech story: 3, then 0.5, then nothing', async () => {
    expect(await payouts('speech', 'a1-restaurante', 4)).toEqual([3, 0.5, 0, 0]);
  });

  it('xpForRepeat reads the table and is 0 past its end', () => {
    for (const kind of Object.keys(XP_TABLE) as XpKind[]) {
      XP_TABLE[kind].forEach((points, i) => expect(xpForRepeat(kind, i)).toBe(points));
      expect(xpForRepeat(kind, XP_TABLE[kind].length)).toBe(0);
    }
  });
});

describe('the count is per item per day', () => {
  it('another item starts from the first payout again', async () => {
    await payouts('grammar', 'item-a', 3, '2031-03-02');
    expect(await awardXp('grammar', 'item-b', '2031-03-02')).toBe(2);
  });

  it('the next day the same item pays the first number again', async () => {
    await payouts('grammar', 'item-c', 3, '2031-03-03');
    expect(await awardXp('grammar', 'item-c', '2031-03-04')).toBe(2);
  });

  it('adds what it pays to the day\'s XP (tenths, no drift)', async () => {
    const before = (await getXp('2031-03-05')).xp;
    await payouts('grammar', 'item-d', 3, '2031-03-05');
    await payouts('speech', 'story-d', 3, '2031-03-05');
    expect((await getXp('2031-03-05')).xp - before).toBeCloseTo(2 + 0.5 + 3 + 0.5, 10);
  });

  it('two answers fired at once are counted one after the other', async () => {
    const both = await Promise.all([awardXp('grammar', 'item-e', '2031-03-06'), awardXp('grammar', 'item-e', '2031-03-06')]);
    expect(both).toEqual([2, 0.5]);
  });

  it('survives an app kill: the count is read back from the stored state', async () => {
    await payouts('grammar', 'item-f', 2, '2031-03-07');
    const saved = await exportWebState();
    // the app is killed: modules and the in-memory db are gone, only the stored state is read back
    let reborn: Promise<number> = Promise.resolve(-1);
    await jest.isolateModulesAsync(async () => {
      const db = require('../database.web');
      await db.importWebState(saved);
      const fresh = require('../xpAward');
      reborn = fresh.awardXp('grammar', 'item-f', '2031-03-07');
      await reborn;
    });
    expect(await reborn).toBe(0);
  });
});

describe('one row, bounded by a day', () => {
  it('many items on two days still leave exactly one row, and a new date starts from empty', async () => {
    await payouts('grammar', 'row-a', 2, '2031-04-01');
    await payouts('sentence', 'row-b', 1, '2031-04-01');
    await awardXp('grammar', 'row-c', '2031-04-02');
    const rows = (await getDb().getGameProgress('xp-items')).filter((r) => r.itemId === 'today');
    expect(rows).toHaveLength(1);
    expect(Object.keys((rows[0].data as { counts: object }).counts)).toEqual(['row-c']);
    expect(await awardXp('grammar', 'row-a', '2031-04-02')).toBe(2);
  });

  it('a grammar item is one item on every screen, level practice keeps its own count', async () => {
    expect(await awardXp('grammar', 'shared-q', '2031-04-03')).toBe(2);
    expect(await awardXp('grammar', 'shared-q', '2031-04-03')).toBe(0.5);
    expect(await awardXp('levelPractice', 'shared-q', '2031-04-03')).toBe(0.5);
  });
});

describe('isHardSentence', () => {
  const eight = 'uno dos tres cuatro cinco seis siete ocho';
  it('8 words is hard, 7 words is not', () => {
    expect(isHardSentence(eight, 'A1', 'A1', PCIC_LEVELS)).toBe(true);
    expect(isHardSentence('uno dos tres cuatro cinco seis siete', 'A1', 'A1', PCIC_LEVELS)).toBe(false);
  });

  it('counts words, not spaces', () => {
    expect(isHardSentence('  uno   dos  ', 'A1', 'A1', PCIC_LEVELS)).toBe(false);
  });

  it('a sentence above the learner\'s level is hard, at or below it is not', () => {
    expect(isHardSentence('Hola.', 'B1', 'A2', PCIC_LEVELS)).toBe(true);
    expect(isHardSentence('Hola.', 'A2', 'A2', PCIC_LEVELS)).toBe(false);
    expect(isHardSentence('Hola.', 'A1', 'B2', PCIC_LEVELS)).toBe(false);
  });

  it('an unknown level is never "above"', () => {
    expect(isHardSentence('Hola.', undefined, 'A1', PCIC_LEVELS)).toBe(false);
    expect(isHardSentence('Hola.', 'B1', undefined, PCIC_LEVELS)).toBe(false);
  });
});
