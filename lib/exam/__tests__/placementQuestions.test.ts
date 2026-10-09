// a szintfelmérő kérdései a valódi
// data/words-open készletből és a szintek nyelvtani leckéiből, mindkét irányban.

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
  it('en→es: A1-B2, es→en: A1-B1 (a B2 üres)', () => {
    setPcicTarget('es');
    expect(placementLevels()).toEqual(['A1', 'A2', 'B1', 'B2']);
    setPcicTarget('en');
    expect(placementLevels()).toEqual(['A1', 'A2', 'B1']);
  });
});

describe('buildPlacementQuestion: szó-kérdés', () => {
  const cases: [PcicTarget, PcicLevel][] = [];
  for (const target of ['es', 'en'] as const) {
    setPcicTarget(target);
    for (const level of PCIC_LEVELS) if (pcicItemsForLevel(level).length > 0) cases.push([target, level]);
  }
  setPcicTarget('es');

  it.each(cases)('%s %s: a szint minden szavából jó kérdés lesz: 4 különböző válasz, egy jó, két jó válasz soha', (target, level) => {
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
      // Azonos írású másik szó jelentése nem lehet csapda (az is jó válasz lenne).
      const homographMeanings = items
        .filter((i) => i.id !== item.id && norm((target === 'es' ? i.es : i.en).split(' / ')[0]) === norm(q.word))
        .map((i) => norm(target === 'es' ? i.en : i.es));
      for (const [i, option] of q.options.entries()) {
        if (i !== q.correctIndex) expect(homographMeanings).not.toContain(norm(option));
      }
      used.add(placementQuestionKey(q));
      built++;
    }
    // Az utolsó néhány szónak nincs elég csapdája csak ha a készlet szinte üres; itt a szint szavainak (szinte) mind kérdés lesz.
    expect(built).toBeGreaterThanOrEqual(items.length - 5);
    expect(used.size).toBe(built);
  });

  it('a perjeles célnyelvi alaknál az első alternatíva a kérdezett szó', () => {
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

  it('ugyanaz a seed ugyanazt a kérdést adja, más seed mást', () => {
    setPcicTarget('es');
    const pool = placementPoolFor('A2', 'es');
    const input = { level: 'A2' as const, position: 0, target: 'es' as const, pool, used: new Set<string>() };
    expect(buildPlacementQuestion({ ...input, seed: 11 })).toEqual(buildPlacementQuestion({ ...input, seed: 11 }));
    const seeds = new Set(Array.from({ length: 20 }, (_, i) => placementQuestionKey(buildPlacementQuestion({ ...input, seed: i })!)));
    expect(seeds.size).toBeGreaterThan(5);
  });
});

describe('buildPlacementQuestion: nyelvtan és sorrend', () => {
  it('egy lépcső sorrendje: szó, nyelvtan, szó, nyelvtan, szó', () => {
    expect([...PLACEMENT_PATTERN]).toEqual(['word', 'gap', 'word', 'gap', 'word']);
  });

  it('az A1 (es) lépcsőjén a nyelvtan-helyeken lyukas mondat van, minden kérdés más', () => {
    setPcicTarget('es');
    const pool = placementPoolFor('A1', 'es');
    expect(pool.gaps.length).toBeGreaterThan(10);
    const used = new Set<string>();
    const kinds: string[] = [];
    // 4 lépcsőnyi (20) kérdés ugyanazon a szinten.
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

  it('a lecke KÉSZ voltától függetlenül a szint összes megírt leckéjéből jön nyelvtan', () => {
    setPcicTarget('es');
    const topics = new Set(placementPoolFor('A1', 'es').gaps.map((g) => g.topicId));
    expect(topics.size).toBeGreaterThan(3);
  });

  it('ha a szinthez nincs nyelvtan, a nyelvtan-helyen is szó jön', () => {
    setPcicTarget('es');
    const pool: PlacementPool = { items: placementPoolFor('A1', 'es').items, gaps: [] };
    const q = buildPlacementQuestion({ level: 'A1', position: 1, target: 'es', pool, used: new Set(), seed: 2 });
    expect(q?.kind).toBe('word');
  });

  it('ha elfogyott a készlet, undefined', () => {
    const q = buildPlacementQuestion({ level: 'A1', position: 0, target: 'es', pool: { items: [], gaps: [] }, used: new Set(), seed: 1 });
    expect(q).toBeUndefined();
  });

  it('minden szinten van nyelvtani készlet vagy a szó-készlet pótolja (es és en)', () => {
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
