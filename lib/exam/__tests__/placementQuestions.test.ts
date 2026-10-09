// The placement questions are built from the real data/words-open set and the grammar
// lessons of each level, in both directions.

import { PCIC_LEVELS, pcicItemsForLevel, setPcicTarget, type PcicItem, type PcicLevel, type PcicTarget } from '@/data/pcic';
import {
  PLACEMENT_PATTERN,
  buildPlacementQuestion,
  placementLevels,
  placementPoolFor,
  placementQuestionKey,
  type PlacementPool,
  type PlacementQuestion,
} from '../placementQuestions';

const norm = (text: string) => text.trim().toLowerCase();

afterEach(() => setPcicTarget('es'));

describe('placementLevels', () => {
  it('en→es: A1-B2, es→en: A1-B1 (B2 is empty)', () => {
    setPcicTarget('es');
    expect(placementLevels()).toEqual(['A1', 'A2', 'B1', 'B2']);
    setPcicTarget('en');
    expect(placementLevels()).toEqual(['A1', 'A2', 'B1']);
  });
});

describe('buildPlacementQuestion: word question', () => {
  const cases: [PcicTarget, PcicLevel][] = [];
  for (const target of ['es', 'en'] as const) {
    setPcicTarget(target);
    for (const level of PCIC_LEVELS) if (pcicItemsForLevel(level).length > 0) cases.push([target, level]);
  }
  setPcicTarget('es');

  it.each(cases)('%s %s: every word of the level makes a good question: 4 different answers, one right, never two right answers', (target, level) => {
    setPcicTarget(target);
    const items = pcicItemsForLevel(level);
    const pool: PlacementPool = { items, gaps: [] };
    const used = new Set<string>();
    let built = 0;
    for (let guard = 0; guard < items.length + 5; guard++) {
      const q = buildPlacementQuestion({ level, position: 0, target, pool, used, seed: 7 });
      if (!q) break;
      expect(q.kind).toBe('word');
      if (q.kind !== 'word') break;
      const item = items.find((i) => i.id === q.itemId) as PcicItem;
      const meaning = target === 'es' ? item.en : item.es;
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options.map(norm)).size).toBe(4);
      expect(q.options[q.correctIndex]).toBe(meaning.trim());
      // The meaning of another word with the same spelling cannot be a trap (it would also be a correct answer).
      const homographMeanings = items
        .filter((i) => i.id !== item.id && norm((target === 'es' ? i.es : i.en).split(' / ')[0]) === norm(q.word))
        .map((i) => norm(target === 'es' ? i.en : i.es));
      for (const [i, option] of q.options.entries()) {
        if (i !== q.correctIndex) expect(homographMeanings).not.toContain(norm(option));
      }
      used.add(placementQuestionKey(q));
      built++;
    }
    // The last few words lack enough traps only when the pool is almost empty; here (nearly) all of the level's words become questions.
    expect(built).toBeGreaterThanOrEqual(items.length - 5);
    expect(used.size).toBe(built);
  });

  it('for a slash-separated target-language form the first alternative is the asked word', () => {
    setPcicTarget('es');
    const pool: PlacementPool = {
      items: [
        { id: 'x1', es: 'el carro / el coche', en: 'the car', kind: 'phrase', section: '', order: 1, pos: 'noun' },
        { id: 'x2', es: 'la casa', en: 'the house', kind: 'phrase', section: '', order: 2, pos: 'noun' },
        { id: 'x3', es: 'el libro', en: 'the book', kind: 'phrase', section: '', order: 3, pos: 'noun' },
        { id: 'x4', es: 'la mesa', en: 'the table', kind: 'phrase', section: '', order: 4, pos: 'noun' },
      ],
      gaps: [],
    };
    const used = new Set<string>();
    const words: string[] = [];
    for (let i = 0; i < 4; i++) {
      const q = buildPlacementQuestion({ level: 'A1', position: 0, target: 'es', pool, used, seed: 3 });
      expect(q?.kind).toBe('word');
      if (q?.kind !== 'word') return;
      words.push(q.word);
      used.add(placementQuestionKey(q));
    }
    expect(words).toContain('el carro');
    expect(words).not.toContain('el carro / el coche');
  });

  it('the same seed gives the same question, a different seed a different one', () => {
    setPcicTarget('es');
    const pool = placementPoolFor('A2', 'es');
    const input = { level: 'A2' as const, position: 0, target: 'es' as const, pool, used: new Set<string>() };
    expect(buildPlacementQuestion({ ...input, seed: 11 })).toEqual(buildPlacementQuestion({ ...input, seed: 11 }));
    const seeds = new Set(Array.from({ length: 20 }, (_, i) => placementQuestionKey(buildPlacementQuestion({ ...input, seed: i })!)));
    expect(seeds.size).toBeGreaterThan(5);
  });
});

describe('buildPlacementQuestion: grammar and order', () => {
  it('the order of one step: word, grammar, word, grammar, word', () => {
    expect([...PLACEMENT_PATTERN]).toEqual(['word', 'gap', 'word', 'gap', 'word']);
  });

  it('on the A1 (es) step the grammar places have a gap sentence, every question different', () => {
    setPcicTarget('es');
    const pool = placementPoolFor('A1', 'es');
    expect(pool.gaps.length).toBeGreaterThan(10);
    const used = new Set<string>();
    const kinds: string[] = [];
    // Four steps' worth (20) of questions on the same level.
    for (let n = 0; n < 20; n++) {
      const q = buildPlacementQuestion({ level: 'A1', position: n % 5, target: 'es', pool, used, seed: 5 }) as PlacementQuestion;
      expect(q).toBeDefined();
      kinds.push(q.kind);
      if (q.kind === 'gap') {
        expect(q.sentence).toContain('___');
        expect(q.options.length).toBeGreaterThanOrEqual(2);
        expect(q.correctIndex).toBeGreaterThanOrEqual(0);
        expect(q.correctIndex).toBeLessThan(q.options.length);
      }
      used.add(placementQuestionKey(q));
    }
    expect(kinds.slice(0, 5)).toEqual([...PLACEMENT_PATTERN]);
    expect(used.size).toBe(20);
  });

  it('grammar comes from all written lessons of the level regardless of whether the lesson is DONE', () => {
    setPcicTarget('es');
    const topics = new Set(placementPoolFor('A1', 'es').gaps.map((g) => g.topicId));
    expect(topics.size).toBeGreaterThan(3);
  });

  it('if the level has no grammar, a word comes at the grammar place too', () => {
    setPcicTarget('es');
    const pool: PlacementPool = { items: placementPoolFor('A1', 'es').items, gaps: [] };
    const q = buildPlacementQuestion({ level: 'A1', position: 1, target: 'es', pool, used: new Set(), seed: 2 });
    expect(q?.kind).toBe('word');
  });

  it('when the supply has run out, undefined', () => {
    const q = buildPlacementQuestion({ level: 'A1', position: 0, target: 'es', pool: { items: [], gaps: [] }, used: new Set(), seed: 1 });
    expect(q).toBeUndefined();
  });

  it('every level has a grammar supply or the word supply fills in (es and en)', () => {
    for (const target of ['es', 'en'] as const) {
      setPcicTarget(target);
      for (const level of placementLevels()) {
        const pool = placementPoolFor(level, target);
        const q = buildPlacementQuestion({ level, position: 1, target, pool, used: new Set(), seed: 4 });
        expect(q).toBeDefined();
      }
    }
  });
});
