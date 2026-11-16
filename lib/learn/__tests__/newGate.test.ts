import { arrangeQueue, emptyFatigue } from '@/lib/learn/fatigue';
import { holdNewUntilMissedTyped } from '@/lib/learn/newGate';
import { sm2NewCard } from '@/lib/sm2';
import type { QueuedSm2Card } from '@/lib/pcicSession';

const day = '2026-11-16';
const review = (id: string): QueuedSm2Card => ({ ...sm2NewCard(id), state: 'review', interval: 3, due: '2026-11-01', introducedAt: '2026-10-20' });
const missed = (id: string, returnAt?: number): QueuedSm2Card => ({ ...sm2NewCard(id), state: 'learning', due: day, introducedAt: day, returnAt });
const fresh = (id: string): QueuedSm2Card => sm2NewCard(id);
const ids = (q: QueuedSm2Card[]) => q.map((c) => c.itemId);

describe('holdNewUntilMissedTyped', () => {
  it('puts every new word behind a new word missed today, even before its timer expires', () => {
    expect(ids(holdNewUntilMissedTyped([fresh('n0'), fresh('n1'), missed('m0', Date.now() + 60000)], day))).toEqual(['m0', 'n0', 'n1']);
  });
  it('holds new words behind far-back missed words and reviews alike', () => {
    const q = [review('r0'), fresh('n0'), review('r1'), missed('m0', 1)];
    expect(ids(holdNewUntilMissedTyped(q, day))).toEqual(['r0', 'r1', 'm0', 'n0']);
  });
  it('is a no-op once the missed word is typed right (it left the learning state) or when nothing was missed', () => {
    const q = [fresh('n0'), { ...missed('m0'), state: 'review' as const }, fresh('n1')];
    expect(holdNewUntilMissedTyped(q, day)).toBe(q);
    const plain = [fresh('n0'), review('r0')];
    expect(holdNewUntilMissedTyped(plain, day)).toBe(plain);
  });
  it('does not treat a relearning old review card as a missed new word', () => {
    const q = [fresh('n0'), { ...missed('x'), introducedAt: '2026-10-01' }];
    expect(holdNewUntilMissedTyped(q, day)).toBe(q);
  });
  it('waits for every missed new word, not just one', () => {
    expect(ids(holdNewUntilMissedTyped([fresh('n0'), missed('m0'), missed('m1')], day))).toEqual(['m0', 'm1', 'n0']);
  });
});

describe('arrangeQueue with the new-word gate', () => {
  const q = [fresh('n0'), missed('m0', Date.now() + 60000)];
  it('is off unless asked: the old order stays bit for bit', () => {
    const opts = { tiredButton: false, missCap: false, mixNew: true };
    expect(arrangeQueue(q, day, emptyFatigue(day), opts)).toEqual(q);
    expect(ids(arrangeQueue(q, day, emptyFatigue(day), { ...opts, newGate: true }))).toEqual(['m0', 'n0']);
  });
  it('keeps the card on screen when keepFirst is set', () => {
    const out = arrangeQueue(q, day, emptyFatigue(day), { tiredButton: false, missCap: false, newGate: true, keepFirst: true });
    expect(ids(out)).toEqual(['n0', 'm0']);
  });
  it('a parked missed word no longer holds anything back', () => {
    const state = { ...emptyFatigue(day), parked: ['m0'] };
    expect(ids(arrangeQueue(q, day, state, { tiredButton: false, missCap: true, newGate: true }))).toEqual(['n0']);
  });
  it('works with tired mode, which already sorts new words last', () => {
    const state = { ...emptyFatigue(day), tired: true };
    const queue = [review('r0'), fresh('n0'), missed('m0', Date.now() + 60000)];
    expect(ids(arrangeQueue(queue, day, state, { tiredButton: true, missCap: false, newGate: true }))).toEqual(['r0', 'm0', 'n0']);
  });
});
