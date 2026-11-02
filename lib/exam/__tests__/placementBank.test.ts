// The German placement bank (data/exams/placement/de.json): German has no grammar lessons yet, so its grammar questions come from
// 20 reviewed gap sentences per level. Every row must be a clean question: one blank, four different options, one right.

import type { PcicTarget } from '@/data/pcic';
import { PCIC_LEVELS } from '@/data/pcic';
import de from '@/data/exams/placement/de.json';
import { buildPlacementQuestion, placementPoolFor } from '../placementQuestions';
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
      const pool = placementPoolFor(level, 'de' as PcicTarget);
      expect(pool.gaps.filter((g) => g.topicId === PLACEMENT_BANK_TOPIC)).toHaveLength(20);
    }
  });

  it('a gap question of the bank has the four options and the right one is the bank answer', () => {
    const [gap] = placementBankGaps('B1', 'de');
    const q = buildPlacementQuestion({ level: 'B1', position: 1, target: 'de' as PcicTarget, pool: { items: [], gaps: [gap] }, used: new Set(), seed: 3 });
    expect(q).toMatchObject({ kind: 'gap', level: 'B1', topicId: PLACEMENT_BANK_TOPIC, itemId: gap.itemId, sentence: gap.sentence });
    if (q?.kind !== 'gap') throw new Error('a gap question was expected');
    expect([...q.options].sort()).toEqual([...gap.options].sort());
    expect(q.options[q.correctIndex]).toBe(gap.options[gap.correct]);
  });

  it('the bank questions are not asked twice in a step (the question key is unique)', () => {
    const gaps = placementBankGaps('A2', 'de');
    const used = new Set<string>();
    for (let i = 0; i < 20; i += 1) {
      const q = buildPlacementQuestion({ level: 'A2', position: 1, target: 'de' as PcicTarget, pool: { items: [], gaps }, used, seed: 5 });
      expect(q).toBeDefined();
      const key = `g:${q!.kind === 'gap' ? `${q!.topicId}:${q!.itemId}` : ''}`;
      expect(used.has(key)).toBe(false);
      used.add(key);
    }
    expect(buildPlacementQuestion({ level: 'A2', position: 1, target: 'de' as PcicTarget, pool: { items: [], gaps }, used, seed: 5 })).toBeUndefined();
  });
});
