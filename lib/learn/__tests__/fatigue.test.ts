import { arrangeQueue, emptyFatigue, readFatigue, recordMiss, undoMiss } from '../fatigue';
import { applyLearnResume, buildLearnResume } from '@/lib/learnResume';
import { sm2NewCard } from '@/lib/sm2';
import { mixNewCards, type QueuedSm2Card } from '@/lib/pcicSession';

const day = '2026-11-14';
const opts = { tiredButton: true, missCap: true };
const review = (itemId: string, interval = 10, ease = 2.5, lapses = 0): QueuedSm2Card => ({
  ...sm2NewCard(itemId), state: 'review', introducedAt: '2026-11-01', due: day, interval, ease, lapses,
});
const tired = () => ({ ...emptyFatigue(day), tired: true });
const ids = (q: QueuedSm2Card[]) => q.map((c) => c.itemId);

describe('fatigue queue layer', () => {
  it('sorts only ordinary review slots, stably, by interval, ease and lapses', () => {
    const timed = { ...review('timed'), returnAt: 123 };
    const introduced = { ...review('today'), introducedAt: day };
    const q = [review('short', 1), timed, review('low-ease', 20, 2), introduced,
      review('many-lapses', 20, 3, 2), review('tie-a', 20, 3, 1), review('tie-b', 20, 3, 1)];
    const before = q.map((c) => ({ ...c }));
    expect(ids(arrangeQueue(q, day, tired(), opts))).toEqual(['tie-a', 'timed', 'tie-b', 'today', 'many-lapses', 'low-ease', 'short']);
    expect(q).toEqual(before);
  });

  it('moves new cards to the end in their order and preserves a revealed head', () => {
    const q = [sm2NewCard('new-a'), review('hard', 1), sm2NewCard('new-b'), review('easy', 30)];
    expect(ids(arrangeQueue(q, day, tired(), opts))).toEqual(['easy', 'hard', 'new-a', 'new-b']);
    expect(ids(arrangeQueue(q, day, tired(), { ...opts, keepFirst: true }))).toEqual(['new-a', 'easy', 'hard', 'new-b']);
  });

  it('both settings off returns the identical input even with saved tired and parked state', () => {
    const q = [review('hard', 1), sm2NewCard('new'), review('easy', 30)];
    expect(arrangeQueue(q, day, { ...tired(), parked: ['hard'] }, { tiredButton: false, missCap: false })).toBe(q);
  });

  it('the normal session path keeps the existing mix, while tired mode bypasses it', () => {
    const q = [review('hard', 1), review('easy', 30), sm2NewCard('new')];
    expect(arrangeQueue(q, day, tired(), { tiredButton: false, missCap: false, mixNew: true })).toEqual(mixNewCards(q, day));
    expect(ids(arrangeQueue(q, day, tired(), { ...opts, mixNew: true }))).toEqual(['easy', 'hard', 'new']);
    expect(ids(arrangeQueue(q, day, { ...tired(), parked: ['hard'] }, { tiredButton: false, missCap: true }))).toEqual(['easy', 'new']);
  });

  it('keeps the first three misses and parks on the fourth; undo restores the count and card', () => {
    let state = emptyFatigue(day);
    const q = [review('a')];
    for (let n = 1; n <= 3; n++) {
      state = recordMiss(state, day, 'a');
      expect(state.misses.a).toBe(n);
      expect(arrangeQueue(q, day, state, opts)).toEqual(q);
    }
    state = recordMiss(state, day, 'a');
    expect(arrangeQueue(q, day, state, opts)).toEqual([]);
    const undone = undoMiss(state, day, 'a', true);
    expect(undone.misses.a).toBe(3);
    expect(undone.parked).toEqual([]);
    expect(arrangeQueue(q, day, undone, opts)).toEqual(q);
    expect(state.misses.a).toBe(4);
  });

  it('undo of a nonparking miss keeps other parked cards and never makes a negative count', () => {
    const state = { ...emptyFatigue(day), misses: { a: 1 }, parked: ['other'] };
    expect(undoMiss(state, day, 'a', false)).toEqual({ ...state, misses: {} });
    expect(undoMiss(state, day, 'absent', false).misses).toEqual({ a: 1 });
  });

  it('a new day and malformed saved values produce clean daily state', () => {
    for (const value of [null, {}, { ...tired(), day: '2026-11-13', misses: { a: 4 }, parked: ['a'] },
      { ...tired(), misses: { a: -1 } }, { ...tired(), parked: [123] }]) {
      expect(readFatigue(value, day)).toEqual(emptyFatigue(day));
    }
    expect(readFatigue(tired(), day)).toEqual(tired());
    expect(recordMiss(tired(), '2026-11-15', 'a')).toEqual({ ...emptyFatigue('2026-11-15'), misses: { a: 1 } });
  });

  it('filters parked cards after resume, across all queue builds, only when the cap is on', () => {
    const q = [review('a'), review('b')];
    const resumed = applyLearnResume(q, buildLearnResume([...q].reverse(), day, 'A1', null), day, 'A1');
    const state = { ...emptyFatigue(day), parked: ['b'] };
    expect(ids(arrangeQueue(resumed, day, state, opts))).toEqual(['a']);
    expect(arrangeQueue(resumed, day, state, { ...opts, missCap: false })).toBe(resumed);
    expect(arrangeQueue(resumed, '2026-11-15', state, opts)).toBe(resumed);
  });
});
