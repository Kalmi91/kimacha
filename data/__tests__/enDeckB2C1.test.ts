// The English target deck above B1 (es→en and hu→en): data/words/en/{b2,c1}.json and their Hungarian
// overlay data/words/en/gloss-hu/{b2,c1}.json. scripts/validate-en-track.mjs gates the structure;
// this test pins the part the app depends on: no half-empty card, and a Hungarian row
// (hu + sentence_hu) for every card, keyed by the card id.

import enB2 from '@/data/words/en/b2.json';
import enC1 from '@/data/words/en/c1.json';
import glossB2 from '@/data/words/en/gloss-hu/b2.json';
import glossC1 from '@/data/words/en/gloss-hu/c1.json';
import topicsB2 from '@/data/topics/en/b2.json';
import topicsC1 from '@/data/topics/en/c1.json';

type Card = { id: number; level: string; es: string; en: string; topic: string; topicOrder: number; sentence_es: string; sentence_en: string; pos: string };
type Gloss = { k: number; hu: string; sentence_hu: string };
type Topic = { id: string; type: string };

const DECKS = [
  { level: 'B2', cards: enB2 as Card[], gloss: glossB2 as Gloss[], topics: topicsB2 as Topic[], block: [11000, 11999] },
  { level: 'C1', cards: enC1 as Card[], gloss: glossC1 as Gloss[], topics: topicsC1 as Topic[], block: [12000, 12999] },
];

const filled = (s: unknown) => typeof s === 'string' && s.trim().length > 0;

describe.each(DECKS)('English deck $level', ({ level, cards, gloss, topics, block }) => {
  it('is not empty and its ids sit in the reserved block, unique', () => {
    expect(cards.length).toBeGreaterThan(400);
    expect(new Set(cards.map((c) => c.id)).size).toBe(cards.length);
    for (const c of cards) {
      expect(c.id).toBeGreaterThanOrEqual(block[0]);
      expect(c.id).toBeLessThanOrEqual(block[1]);
      expect(c.level).toBe(level);
    }
  });

  it('every card has es, en, sentence_es, sentence_en, pos and a vocab topic of its level', () => {
    const vocab = new Set(topics.filter((t) => t.type === 'vocab').map((t) => t.id));
    for (const c of cards) {
      for (const field of ['es', 'en', 'sentence_es', 'sentence_en', 'pos'] as const) {
        if (!filled(c[field])) throw new Error(`${level} card ${c.id}: empty ${field}`);
      }
      if (!vocab.has(c.topic)) throw new Error(`${level} card ${c.id}: topic ${c.topic} is not a ${level} vocab topic`);
      expect(c.topicOrder).toBeGreaterThan(0);
    }
  });

  it('every card has exactly one Hungarian gloss row with hu + sentence_hu, and no gloss row is orphaned', () => {
    const byKey = new Map(gloss.map((g) => [g.k, g]));
    expect(byKey.size).toBe(gloss.length);
    expect(gloss.length).toBe(cards.length);
    for (const c of cards) {
      const g = byKey.get(c.id);
      if (!g) throw new Error(`${level} card ${c.id} (${c.en}): no gloss-hu row`);
      if (!filled(g.hu)) throw new Error(`${level} card ${c.id} (${c.en}): empty hu`);
      if (!filled(g.sentence_hu)) throw new Error(`${level} card ${c.id} (${c.en}): empty sentence_hu`);
    }
  });

  it('the Hungarian text has no õ / û (the Hungarian letters are ő / ű)', () => {
    for (const g of gloss) {
      if (/[õûÕÛ]/.test(`${g.hu} ${g.sentence_hu}`)) throw new Error(`${level} gloss ${g.k}: õ/û in ${g.hu} / ${g.sentence_hu}`);
    }
  });
});
