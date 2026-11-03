// The German placement bank (data/exams/placement/de.json): German has no grammar lessons yet, so its grammar questions come from
// 20 reviewed gap sentences per level. Every row must be a clean question: one blank, four different options, one right.

import { PCIC_LEVELS, pcicItemsForLevel, setPcicTarget, type PcicItem } from '@/data/pcic';
import de from '@/data/exams/placement/de.json';
import { PLACEMENT_PATTERN, buildPlacementQuestion, placementLevels, placementPoolFor, placementQuestionKey } from '../placementQuestions';
import { PLACEMENT_BANK_TOPIC, placementBankGaps } from '../placementBank';

const rows = PCIC_LEVELS.flatMap((level) => ((de as Record<string, { id: string; sentence: string; options: string[]; correct: number }[]>)[level] ?? []).map((row) => [`${level} ${row.id}`, level, row] as const));

describe('data/exams/placement/de.json', () => {
  it('has 20 sentences for each of the five levels, with unique ids', () => {
    for (const level of PCIC_LEVELS) expect(placementBankGaps(level, 'de')).toHaveLength(20);
    expect(new Set(rows.map(([, , row]) => row.id)).size).toBe(100);
  });

  it.each(rows)('%s is a clean question', (_name, level, row) => {
    expect(row.id.startsWith(level.toLowerCase())).toBe(true);
    expect(row.sentence.match(/___/g)).toHaveLength(1);
    expect(row.sentence).not.toMatch(new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`));
    expect(row.options).toHaveLength(4);
    expect(new Set(row.options.map((o) => o.toLowerCase())).size).toBe(4);
    expect(Number.isInteger(row.correct) && row.correct >= 0 && row.correct < 4).toBe(true);
    // the right option makes a sentence that is not identical to a wrong one
    expect(row.options.every((o) => o.trim() === o && o.length > 0)).toBe(true);
  });

  it('the right answers are spread over the four positions', () => {
    const counts = [0, 0, 0, 0];
    for (const [, , row] of rows) counts[row.correct] += 1;
    for (const n of counts) expect(n).toBeGreaterThanOrEqual(15);
  });
});

describe('the bank in the placement pool', () => {
  it('a target without a bank has none, German adds it to the pool of every level', () => {
    expect(placementBankGaps('A1', 'es')).toEqual([]);
    expect(placementBankGaps('A1', 'hu')).toEqual([]);
    for (const level of PCIC_LEVELS) {
      const pool = placementPoolFor(level, 'de');
      expect(pool.gaps.filter((g) => g.topicId === PLACEMENT_BANK_TOPIC)).toHaveLength(20);
    }
  });

  it('a gap question of the bank has the four options and the right one is the bank answer', () => {
    const [gap] = placementBankGaps('B1', 'de');
    const q = buildPlacementQuestion({ level: 'B1', position: 1, target: 'de', pool: { items: [], gaps: [gap] }, used: new Set(), seed: 3 });
    expect(q).toMatchObject({ kind: 'gap', level: 'B1', topicId: PLACEMENT_BANK_TOPIC, itemId: gap.itemId, sentence: gap.sentence });
    if (q?.kind !== 'gap') throw new Error('a gap question was expected');
    expect([...q.options].sort()).toEqual([...gap.options].sort());
    expect(q.options[q.correctIndex]).toBe(gap.options[gap.correct]);
  });

  it('the bank questions are not asked twice in a step (the question key is unique)', () => {
    const gaps = placementBankGaps('A2', 'de');
    const used = new Set<string>();
    for (let i = 0; i < 20; i += 1) {
      const q = buildPlacementQuestion({ level: 'A2', position: 1, target: 'de', pool: { items: [], gaps }, used, seed: 5 });
      expect(q).toBeDefined();
      const key = `g:${q!.kind === 'gap' ? `${q!.topicId}:${q!.itemId}` : ''}`;
      expect(used.has(key)).toBe(false);
      used.add(key);
    }
    expect(buildPlacementQuestion({ level: 'A2', position: 1, target: 'de', pool: { items: [], gaps }, used, seed: 5 })).toBeUndefined();
  });
});

describe('the placement test on the German deck (data/words/de)', () => {
  afterEach(() => setPcicTarget('es'));

  // The levels of the deck that are built; the others have no words yet and the test does not measure them.
  it.each(['en', 'es', 'hu'] as const)('%s→de: every sampled word of a built level is a good question and a step is word, gap, word, gap, word', (source) => {
    setPcicTarget('de', source);
    const levels = placementLevels();
    expect(levels).toContain('A1');
    for (const level of levels) {
      const items = pcicItemsForLevel(level);
      const pool = placementPoolFor(level, 'de');
      expect(pool.gaps.filter((g) => g.topicId === PLACEMENT_BANK_TOPIC)).toHaveLength(20);
      for (const item of items.filter((_, i) => i % 25 === 0)) {
        const q = buildPlacementQuestion({ level, position: 0, target: 'de', pool: { items, gaps: [] }, used: new Set(Array.from(items, (o) => `w:${o.id}`).filter((k) => k !== `w:${item.id}`)), seed: 7 });
        expect(q?.kind).toBe('word');
        if (q?.kind !== 'word') continue;
        expect(q.itemId).toBe(item.id);
        expect(q.word).toBe((item.de ?? '').split(' / ')[0].trim());
        expect(new Set(q.options.map((o) => o.toLowerCase())).size).toBe(4);
        expect(q.options[q.correctIndex]).toBe((item[source] as string).trim());
      }
      const used = new Set<string>();
      const kinds: string[] = [];
      for (let position = 0; position < PLACEMENT_PATTERN.length; position += 1) {
        const q = buildPlacementQuestion({ level, position, target: 'de', pool, used, seed: 11 });
        expect(q).toBeDefined();
        kinds.push(q!.kind);
        used.add(placementQuestionKey(q!));
      }
      expect(kinds).toEqual([...PLACEMENT_PATTERN]);
      expect(used.size).toBe(PLACEMENT_PATTERN.length);
    }
  });

  it('a card of the German deck without a meaning in the learner\'s language is never asked', () => {
    setPcicTarget('de', 'en');
    const [item] = pcicItemsForLevel('A1');
    const bare: PcicItem = { ...item, en: '' };
    const q = buildPlacementQuestion({ level: 'A1', position: 0, target: 'de', pool: { items: [bare], gaps: [] }, used: new Set(), seed: 1 });
    expect(q).toBeUndefined();
  });
});
