// GAMES.md 4.8 (odd-one-out) acceptance: exactly 4 words, exactly 1 odd one
// out, and the round is buildable from the pool's own metadata (no invented
// words, GAMES.md 0.).

import { buildOddOneOutRound, type OddWordMeta } from '../oddOneOut';

function w(wordId: number, opts: Partial<OddWordMeta> = {}): OddWordMeta {
  return { wordId, learned: `w${wordId}`, native: `n${wordId}`, isNew: false, ...opts };
}

describe('buildOddOneOutRound', () => {
  it('topic category: 4 items, 3 share the topic, 1 (the odd one) does not', () => {
    const pool: OddWordMeta[] = [
      ...Array.from({ length: 5 }, (_, i) => w(i + 1, { topicId: 'comida' })),
      ...Array.from({ length: 5 }, (_, i) => w(i + 10, { topicId: 'ropa' })),
    ];
    for (let seed = 0; seed < 20; seed++) {
      const round = buildOddOneOutRound(pool, 'topic', seed);
      expect(round).not.toBeNull();
      expect(round!.items).toHaveLength(4);
      const odd = round!.items[round!.oddIndex];
      const rest = round!.items.filter((_, i) => i !== round!.oddIndex);
      expect(rest).toHaveLength(3);
      for (const r of rest) expect(r.topicId).toBe(round!.categoryValue);
      expect(odd.topicId).not.toBe(round!.categoryValue);
    }
  });

  it('returns null when no category has both >=3 same and >=1 different', () => {
    const pool: OddWordMeta[] = [w(1, { topicId: 'a' }), w(2, { topicId: 'a' })];
    const round = buildOddOneOutRound(pool, 'topic', 0);
    expect(round).toBeNull();
  });

  it('pos category: groups by noun/verb/adj/adv only', () => {
    const pool: OddWordMeta[] = [
      ...Array.from({ length: 5 }, (_, i) => w(i + 1, { pos: 'noun' })),
      w(100, { pos: 'verb' }),
      w(101, { pos: 'pron' }),
    ];
    const round = buildOddOneOutRound(pool, 'pos', 1);
    expect(round).not.toBeNull();
    expect(round!.categoryValue).toBe('noun');
    const odd = round!.items[round!.oddIndex];
    expect(odd.wordId).toBe(100); // the only non-noun candidate (pron is excluded from the universe)
  });

  it('gender category: only groups nouns with m/f gender', () => {
    const pool: OddWordMeta[] = [
      ...Array.from({ length: 5 }, (_, i) => w(i + 1, { pos: 'noun', gender: 'm' })),
      w(100, { pos: 'noun', gender: 'f' }),
      w(101, { pos: 'verb', gender: undefined }),
    ];
    const round = buildOddOneOutRound(pool, 'gender', 2);
    expect(round).not.toBeNull();
    for (const item of round!.items) expect(item.pos).toBe('noun');
  });

  it('every item comes from the input pool, no duplicate wordId in a round', () => {
    const pool: OddWordMeta[] = [
      ...Array.from({ length: 6 }, (_, i) => w(i + 1, { topicId: 'comida' })),
      ...Array.from({ length: 6 }, (_, i) => w(i + 20, { topicId: 'ropa' })),
    ];
    const poolIds = new Set(pool.map((p) => p.wordId));
    for (let seed = 0; seed < 10; seed++) {
      const round = buildOddOneOutRound(pool, 'topic', seed);
      expect(round).not.toBeNull();
      const ids = round!.items.map((i) => i.wordId);
      for (const id of ids) expect(poolIds.has(id)).toBe(true);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('excludeCategoryValue skips a category (avoids repeating the same round back to back)', () => {
    const pool: OddWordMeta[] = [
      ...Array.from({ length: 4 }, (_, i) => w(i + 1, { topicId: 'a' })),
      ...Array.from({ length: 4 }, (_, i) => w(i + 10, { topicId: 'b' })),
    ];
    for (let seed = 0; seed < 20; seed++) {
      const round = buildOddOneOutRound(pool, 'topic', seed, 'a');
      if (round) expect(round.categoryValue).not.toBe('a');
    }
  });
});
