// GAMES.md 4.2 (bubble-pop) acceptance: "kategóriánként mindig van legalább
// 3 jó és 3 rossz buborék, különben a kör nem indul el".

import { buildBubbleRound, type BubbleWordMeta } from '../bubblePop';

function w(wordId: number, opts: Partial<BubbleWordMeta> = {}): BubbleWordMeta {
  return { wordId, learned: `w${wordId}`, native: `n${wordId}`, isNew: false, ...opts };
}

describe('buildBubbleRound', () => {
  it('topic category: returns >=3 good and >=3 bad when enough candidates exist', () => {
    const pool: BubbleWordMeta[] = [
      ...Array.from({ length: 5 }, (_, i) => w(i + 1, { topicId: 'comida' })),
      ...Array.from({ length: 5 }, (_, i) => w(i + 10, { topicId: 'ropa' })),
    ];
    for (let seed = 0; seed < 20; seed++) {
      const round = buildBubbleRound(pool, 'topic', 12, seed);
      expect(round).not.toBeNull();
      const good = round!.items.filter((i) => i.isGood);
      const bad = round!.items.filter((i) => !i.isGood);
      expect(good.length).toBeGreaterThanOrEqual(3);
      expect(bad.length).toBeGreaterThanOrEqual(3);
      for (const g of good) expect(g.topicId).toBe(round!.categoryValue);
      for (const b of bad) expect(b.topicId).not.toBe(round!.categoryValue);
    }
  });

  it('returns null when no category has both >=3 good and >=3 bad', () => {
    // Only 2 words share a topic, and only 2 others exist to be "bad".
    const pool: BubbleWordMeta[] = [w(1, { topicId: 'a' }), w(2, { topicId: 'a' }), w(3, { topicId: 'b' }), w(4, { topicId: 'b' })];
    const round = buildBubbleRound(pool, 'topic', 12, 0);
    expect(round).toBeNull();
  });

  it('pos category: groups by noun/verb/adj/adv only, ignores pron/prep/num/phrase', () => {
    const pool: BubbleWordMeta[] = [
      ...Array.from({ length: 5 }, (_, i) => w(i + 1, { pos: 'noun' })),
      ...Array.from({ length: 5 }, (_, i) => w(i + 10, { pos: 'verb' })),
      w(100, { pos: 'pron' }),
      w(101, { pos: 'prep' }),
    ];
    const round = buildBubbleRound(pool, 'pos', 8, 1);
    expect(round).not.toBeNull();
    expect(['noun', 'verb']).toContain(round!.categoryValue);
    for (const item of round!.items) expect(['noun', 'verb']).toContain(item.pos);
  });

  it('gender category: only groups nouns with m/f gender', () => {
    const pool: BubbleWordMeta[] = [
      ...Array.from({ length: 5 }, (_, i) => w(i + 1, { pos: 'noun', gender: 'm' })),
      ...Array.from({ length: 5 }, (_, i) => w(i + 10, { pos: 'noun', gender: 'f' })),
      w(100, { pos: 'verb', gender: undefined }),
    ];
    const round = buildBubbleRound(pool, 'gender', 8, 2);
    expect(round).not.toBeNull();
    for (const item of round!.items) {
      expect(item.pos).toBe('noun');
      expect(['m', 'f']).toContain(item.gender);
    }
  });

  it('every item in a round comes from the input pool (no invented words)', () => {
    const pool: BubbleWordMeta[] = [
      ...Array.from({ length: 6 }, (_, i) => w(i + 1, { topicId: 'comida' })),
      ...Array.from({ length: 6 }, (_, i) => w(i + 20, { topicId: 'ropa' })),
    ];
    const poolIds = new Set(pool.map((p) => p.wordId));
    const round = buildBubbleRound(pool, 'topic', 12, 5);
    expect(round).not.toBeNull();
    for (const item of round!.items) expect(poolIds.has(item.wordId)).toBe(true);
  });

  it('never returns a bubble set with a duplicate wordId', () => {
    const pool: BubbleWordMeta[] = [
      ...Array.from({ length: 8 }, (_, i) => w(i + 1, { topicId: 'comida' })),
      ...Array.from({ length: 8 }, (_, i) => w(i + 20, { topicId: 'ropa' })),
    ];
    for (let seed = 0; seed < 10; seed++) {
      const round = buildBubbleRound(pool, 'topic', 16, seed);
      const ids = round!.items.map((i) => i.wordId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('excludeCategoryValue skips a category (used to avoid repeating the same round back to back)', () => {
    const pool: BubbleWordMeta[] = [
      ...Array.from({ length: 4 }, (_, i) => w(i + 1, { topicId: 'a' })),
      ...Array.from({ length: 4 }, (_, i) => w(i + 10, { topicId: 'b' })),
    ];
    for (let seed = 0; seed < 20; seed++) {
      const round = buildBubbleRound(pool, 'topic', 8, seed, 'a');
      if (round) expect(round.categoryValue).not.toBe('a');
    }
  });
});
