import { mergeCloudPayloads } from '../merge';

// A web store state (MemoryStore.serializeState) with the given fields over an empty one, as the cloud payload string.
const EMPTY = { v: 1, streak: { current_count: 0, last_date: null, longest_count: 0 }, onboarding: null, userLevels: [], meta: {}, userMeta: {}, settings: [], usageMinutes: [], dailyXp: [], gameProgress: [], pcicCards: [], mistakeBatches: [], mistakeCards: [] };
const payload = (fields: Record<string, unknown> = {}, resume: Record<string, string> = {}) => JSON.stringify({ v: 1, store: JSON.stringify({ ...EMPTY, ...fields }), resume });
const storeOf = (p: string) => JSON.parse(JSON.parse(p).store);
const card = (itemId: string, lastReview: string | null, reps = 1) => ({ itemId, state: 'review', step: 0, ease: 2.5, interval: 1, reps, lapses: 0, due: '2026-10-30', lastReview, introducedAt: '2026-10-20' });

describe('mergeCloudPayloads: usageMinutes and dailyXp', () => {
  it.each(['usageMinutes', 'dailyXp'])('%s: every day of both sides, the larger number where both have the day', (field) => {
    const local = payload({ [field]: [['2026-10-20', 5], ['2026-10-21', 30]] });
    const remote = payload({ [field]: [['2026-10-21', 12], ['2026-10-22', 7], ['2026-10-20', 9]] });
    expect(storeOf(mergeCloudPayloads(local, remote))[field]).toEqual([['2026-10-20', 9], ['2026-10-21', 30], ['2026-10-22', 7]]);
  });

  it('takes the number when only one side has a number for the day', () => {
    const local = payload({ usageMinutes: [['2026-10-20', 'x'], ['2026-10-21', 4]] });
    const remote = payload({ usageMinutes: [['2026-10-20', 6], ['2026-10-21', 'y']] });
    expect(storeOf(mergeCloudPayloads(local, remote)).usageMinutes).toEqual([['2026-10-20', 6], ['2026-10-21', 4]]);
  });

  it('keeps the local field when the remote one is not a serialized Map, and the other way round', () => {
    const good = payload({ usageMinutes: [['2026-10-20', 5]] });
    expect(storeOf(mergeCloudPayloads(good, payload({ usageMinutes: 'broken' }))).usageMinutes).toEqual([['2026-10-20', 5]]);
    expect(storeOf(mergeCloudPayloads(good, payload({ usageMinutes: [[1, 2]] }))).usageMinutes).toEqual([['2026-10-20', 5]]);
    expect(storeOf(mergeCloudPayloads(payload({ usageMinutes: 'broken' }), good)).usageMinutes).toBe('broken');
  });
});

describe('mergeCloudPayloads: pcicCards', () => {
  it('keeps, per card, the one with the later lastReview, and the cards only one side has', () => {
    const local = payload({ pcicCards: [['a', card('a', '2026-10-25', 5)], ['b', card('b', '2026-10-20', 2)], ['only-local', card('only-local', null, 0)]] });
    const remote = payload({ pcicCards: [['a', card('a', '2026-10-24', 4)], ['b', card('b', '2026-10-26', 3)], ['only-remote', card('only-remote', '2026-10-22', 1)]] });
    const cards = new Map<string, any>(storeOf(mergeCloudPayloads(local, remote)).pcicCards);
    expect([...cards.keys()]).toEqual(['a', 'b', 'only-local', 'only-remote']);
    expect(cards.get('a').reps).toBe(5);
    expect(cards.get('b').reps).toBe(3);
    expect(cards.get('only-remote').lastReview).toBe('2026-10-22');
  });

  it('keeps the local card on a tie, when neither was reviewed, and when the remote has a card without a usable lastReview', () => {
    const local = payload({ pcicCards: [['a', card('a', '2026-10-25', 5)], ['b', card('b', null, 1)], ['c', card('c', '2026-10-25', 6)]] });
    const remote = payload({ pcicCards: [['a', card('a', '2026-10-25', 9)], ['b', card('b', null, 8)], ['c', { itemId: 'c', reps: 9 }]] });
    const cards = new Map<string, any>(storeOf(mergeCloudPayloads(local, remote)).pcicCards);
    expect([cards.get('a').reps, cards.get('b').reps, cards.get('c').reps]).toEqual([5, 1, 6]);
  });

  it('takes the remote card that was reviewed over a local one that never was', () => {
    const local = payload({ pcicCards: [['a', card('a', null, 0)]] });
    const remote = payload({ pcicCards: [['a', card('a', '2026-10-24', 4)]] });
    expect(new Map<string, any>(storeOf(mergeCloudPayloads(local, remote)).pcicCards).get('a').reps).toBe(4);
  });
});

describe('mergeCloudPayloads: streak', () => {
  const streak = (current_count: number, last_date: string | null, longest_count: number) => ({ current_count, last_date, longest_count });

  it('takes the whole row of the side with the larger longest_count', () => {
    const local = payload({ streak: streak(1, '2026-10-22', 1) });
    const remote = payload({ streak: streak(3, '2026-10-21', 3) });
    expect(storeOf(mergeCloudPayloads(local, remote)).streak).toEqual(streak(3, '2026-10-21', 3));
    expect(storeOf(mergeCloudPayloads(remote, local)).streak).toEqual(streak(3, '2026-10-21', 3));
  });

  it('keeps the local row on a tie, and when the remote one has no longest_count', () => {
    const local = payload({ streak: streak(2, '2026-10-22', 4) });
    expect(storeOf(mergeCloudPayloads(local, payload({ streak: streak(4, '2026-10-20', 4) }))).streak).toEqual(streak(2, '2026-10-22', 4));
    expect(storeOf(mergeCloudPayloads(local, payload({ streak: { current_count: 9 } }))).streak).toEqual(streak(2, '2026-10-22', 4));
  });
});

describe('mergeCloudPayloads: everything without a rule stays as local has it', () => {
  it('leaves the other store fields and the resume keys alone, whatever the remote has', () => {
    const local = payload(
      { onboarding: { source: 'es', target: 'en' }, userLevels: [['es-en', { level: 'A2' }]], settings: [['es-en', { a: 1 }]], gameProgress: [['k', [['i', { state: 's', data: 1 }]]]], mistakeCards: [['m', card('m', '2026-10-20')]], meta: { skin: 'x' }, userMeta: { userId: 'L' } },
      { 'kimacha-resume': '/local' },
    );
    const remote = payload(
      { onboarding: { source: 'hu', target: 'en' }, userLevels: [['es-en', { level: 'C1' }]], settings: [['es-en', { a: 2 }]], gameProgress: [['other', []]], mistakeCards: [['m', card('m', '2026-10-30')]], meta: { skin: 'y' }, userMeta: { userId: 'R' } },
      { 'kimacha-resume': '/remote', 'kimacha-resume:x': '{}' },
    );
    const merged = mergeCloudPayloads(local, remote);
    const m = storeOf(merged);
    const l = storeOf(local);
    for (const field of ['onboarding', 'userLevels', 'settings', 'gameProgress', 'mistakeCards', 'mistakeBatches', 'meta', 'userMeta']) expect(m[field]).toEqual(l[field]);
    expect(JSON.parse(merged).resume).toEqual({ 'kimacha-resume': '/local' });
    expect(JSON.parse(merged).v).toBe(1);
  });
});

describe('mergeCloudPayloads: what it cannot read', () => {
  const local = payload({ usageMinutes: [['2026-10-20', 5]] });

  it.each([
    ['text that is not JSON', 'not json'],
    ['null', 'null'],
    ['an array', '[]'],
    ['a payload with no store', JSON.stringify({ v: 1, resume: {} })],
    ['a store that is not JSON', JSON.stringify({ v: 1, store: 'S1', resume: {} })],
    ['a store that is not an object', JSON.stringify({ v: 1, store: '5', resume: {} })],
  ])('gives the local payload back for a remote that is %s', (_label, remote) => {
    expect(mergeCloudPayloads(local, remote)).toBe(local);
  });

  it('gives the local payload back when it is the local one that cannot be read', () => {
    expect(mergeCloudPayloads('S1', local)).toBe('S1');
  });
});

describe('mergeCloudPayloads: repeating it', () => {
  it('does not change a merged state by merging the same remote again, and merging a state with itself changes nothing', () => {
    const local = payload({ usageMinutes: [['2026-10-20', 5]], streak: { current_count: 1, last_date: '2026-10-20', longest_count: 1 }, pcicCards: [['a', card('a', '2026-10-20')]] });
    const remote = payload({ usageMinutes: [['2026-10-21', 7]], streak: { current_count: 2, last_date: '2026-10-21', longest_count: 2 }, pcicCards: [['a', card('a', '2026-10-21', 3)]] });
    const once = mergeCloudPayloads(local, remote);
    expect(mergeCloudPayloads(once, remote)).toBe(once);
    expect(mergeCloudPayloads(local, local)).toBe(local);
  });
});
