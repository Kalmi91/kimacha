// The part the Practice tab games share (lib/practice/gameRound.ts): the 8 words, the credit of an answer, the saved round.

import type { PcicItem } from '@/data/pcic';
import { __resetBetaForTest, loadBeta } from '@/lib/beta';
import { __resetForTests as resetDailyXp } from '@/lib/dailyXp';
import { getDb } from '@/lib/database';
import { addDays, sm2NewCard, type Sm2Card } from '@/lib/sm2';
import { localDateString } from '@/lib/usageStats';
import {
  GAME_MIN_WORDS,
  GAME_ROUND_SIZE,
  creditRight,
  creditWrong,
  loadSavedGame,
  parseSavedGame,
  pickGameWords,
  resumeGame,
  saveGame,
  startGame,
  toSaved,
  type GameLogic,
} from '../gameRound';

const TODAY = localDateString();
const item = (id: string): PcicItem => ({ id, es: `la ${id}`, en: id, kind: 'word', section: '', order: 1 });
const lookup = (ids: string[]) => {
  const all = new Map(ids.map((id) => [id, item(id)]));
  return (id: string) => all.get(id);
};
const learned = (itemId: string, over: Partial<Sm2Card> = {}): Sm2Card => ({
  ...sm2NewCard(itemId),
  state: 'review',
  interval: 4,
  reps: 2,
  due: addDays(TODAY, 30),
  lastReview: addDays(TODAY, -1),
  introducedAt: addDays(TODAY, -60),
  ...over,
});
const due = (itemId: string, daysAgo: number) => learned(itemId, { due: addDays(TODAY, -daysAgo) });

describe('pickGameWords', () => {
  const ids = Array.from({ length: 12 }, (_, i) => `w${i}`);

  it('takes the 8 longest overdue words first', () => {
    const cards = [...ids.slice(0, 10).map((id, i) => due(id, i + 1)), learned('w10', { introducedAt: addDays(TODAY, -1) })];
    const words = pickGameWords({ cards, today: TODAY, findItem: lookup(ids) });
    expect(words).toHaveLength(GAME_ROUND_SIZE);
    expect(words.map((w) => w.id)).toEqual(['w9', 'w8', 'w7', 'w6', 'w5', 'w4', 'w3', 'w2']);
  });

  it('adds a freshly learned word that is not due, but never an old one that is not due, a new one or a known one', () => {
    const cards = [
      due('w0', 3),
      learned('w1', { introducedAt: addDays(TODAY, -2) }),
      learned('w2'),
      { ...sm2NewCard('w3') },
      due('w4', 5),
      { ...due('w5', 9), known: true },
    ];
    expect(pickGameWords({ cards, today: TODAY, findItem: lookup(ids) }).map((w) => w.id)).toEqual(['w4', 'w0', 'w1']);
  });

  it('the words of the round it replaces go to the end, not out; a card with no item is skipped', () => {
    const cards = ids.slice(0, 5).map((id, i) => due(id, 10 - i));
    const words = pickGameWords({ cards, today: TODAY, findItem: lookup(ids.slice(0, 4)), avoid: new Set(['w0', 'w1']) });
    expect(words.map((w) => w.id)).toEqual(['w2', 'w3', 'w0', 'w1']);
  });

  it(`fewer than ${GAME_MIN_WORDS} words make no round`, () => {
    const cards = [due('w0', 1), due('w1', 2)];
    expect(pickGameWords({ cards, today: TODAY, findItem: lookup(ids) })).toEqual([]);
  });

  it('usable is told the learned cards (not new, not known), also the ones that are not words of the round', () => {
    const cards = [due('w0', 1), due('w1', 2), learned('w2'), { ...sm2NewCard('w3') }, { ...due('w4', 5), known: true }];
    let seen: ReadonlySet<string> = new Set();
    const words = pickGameWords({
      cards,
      today: TODAY,
      findItem: lookup(ids),
      min: 1,
      usable: (_item, learnedIds) => {
        seen = learnedIds;
        return true;
      },
    });
    expect(words.map((w) => w.id)).toEqual(['w1', 'w0']);
    expect([...seen].sort()).toEqual(['w0', 'w1', 'w2']);
  });
});

describe('credit', () => {
  const db = getDb();
  beforeEach(async () => {
    __resetBetaForTest();
    resetDailyXp();
    await db.resetPcicCards();
    await db.setBetaFlag('xpV2', false);
    await db.addDailyXpTenths(TODAY, -100000);
  });

  it('a right answer is one half; the second half moves the word one step', async () => {
    await db.upsertPcicCard(due('c1', 1));
    await creditRight('c1');
    expect(await db.getPcicCard('c1')).toMatchObject({ halfSteps: 1 });
    await creditRight('c1');
    const after = await db.getPcicCard('c1');
    expect(after).toMatchObject({ halfSteps: 0 });
    expect(after!.due > TODAY).toBe(true);
  });

  it('two wrong typings in a row are one step back; a picked wrong answer changes nothing', async () => {
    await db.upsertPcicCard(learned('c2', { interval: 12, ease: 2 }));
    await creditWrong('c2', false);
    await creditWrong('c2', true);
    expect(await db.getPcicCard('c2')).toMatchObject({ interval: 12, wrongStreak: 1 });
    await creditWrong('c2', true);
    expect(await db.getPcicCard('c2')).toMatchObject({ interval: 6, wrongStreak: 0 });
  });

  it('under the xpV2 switch a half earns its XP, off it earns none', async () => {
    await db.upsertPcicCard(learned('c3'));
    await creditRight('c3');
    expect(await db.getDailyXpTenths(TODAY)).toBe(0);
    await db.setBetaFlag('xpV2', true);
    __resetBetaForTest();
    await loadBeta();
    await db.upsertPcicCard(learned('c4'));
    await creditRight('c4');
    expect(await db.getDailyXpTenths(TODAY)).toBeGreaterThan(0);
  });
});

describe('the saved round', () => {
  type S = { n: number };
  const logic: GameLogic<S> = {
    mode: 'demo',
    start: (ids) => ({ n: ids.length }),
    parse: (raw) => (typeof raw === 'object' && raw !== null && typeof (raw as S).n === 'number' ? (raw as S) : null),
  };
  const findItem = lookup(['a', 'b', 'c']);
  const round = startGame(logic, ['a', 'b', 'c'].map((id) => item(id)), '2026-10-21', 'es');

  it('start gets the learned card ids of the round (none by default)', () => {
    const seen: ReadonlySet<string>[] = [];
    const spy: GameLogic<S> = { ...logic, start: (ids, ctx) => (seen.push(ctx.learned), { n: ids.length }) };
    startGame(spy, [item('a')], '2026-10-21', 'es', new Set(['a', 'z']));
    startGame(spy, [item('a')], '2026-10-21', 'es');
    expect([...seen[0]]).toEqual(['a', 'z']);
    expect(seen[1].size).toBe(0);
  });

  it('is saved under its mode and read back; another mode finds nothing', async () => {
    await saveGame('demo', toSaved('demo', round, { n: 7 }));
    expect(await loadSavedGame('demo')).toMatchObject({ v: 1, mode: 'demo', date: '2026-10-21', target: 'es', ids: ['a', 'b', 'c'], state: { n: 7 } });
    expect(await loadSavedGame('other')).toBeNull();
    await saveGame('demo', null);
    expect(await loadSavedGame('demo')).toBeNull();
  });

  it('parseSavedGame refuses broken values', () => {
    const ok = toSaved('demo', round);
    expect(parseSavedGame(ok, 'demo')).toEqual(ok);
    expect(parseSavedGame(ok, 'other')).toBeNull();
    expect(parseSavedGame(null, 'demo')).toBeNull();
    expect(parseSavedGame({ ...ok, v: 2 }, 'demo')).toBeNull();
    expect(parseSavedGame({ ...ok, target: 'hu' }, 'demo')).toBeNull();
    expect(parseSavedGame({ ...ok, ids: [] }, 'demo')).toBeNull();
    expect(parseSavedGame({ ...ok, ids: ['a', 3] }, 'demo')).toBeNull();
    expect(parseSavedGame({ ...ok, state: undefined }, 'demo')).toBeNull();
  });

  it('resumeGame needs the same day and direction, every card, and a state the mode accepts', () => {
    const saved = toSaved('demo', round, { n: 2 });
    expect(resumeGame(saved, logic, '2026-10-21', 'es', findItem)).toMatchObject({ ids: ['a', 'b', 'c'], state: { n: 2 } });
    expect(resumeGame(saved, logic, '2026-10-22', 'es', findItem)).toBeNull();
    expect(resumeGame(saved, logic, '2026-10-21', 'en', findItem)).toBeNull();
    expect(resumeGame(saved, logic, '2026-10-21', 'es', lookup(['a', 'b']))).toBeNull();
    expect(resumeGame({ ...saved, state: 'broken' }, logic, '2026-10-21', 'es', findItem)).toBeNull();
    expect(resumeGame(null, logic, '2026-10-21', 'es', findItem)).toBeNull();
  });
});
