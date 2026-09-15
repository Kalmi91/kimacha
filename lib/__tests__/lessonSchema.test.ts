// LECKE-SEMA 1-2. szakasz: a pilot (ser-estar) LessonV2-sémájának ellenőrzése.
// Nem a tartalom pedagógiai helyességét méri (az emberi felülvizsgálat
// dolga), hanem hogy a JSON tartja-e a spec kötelező szerkezeti ígéreteit:
// mindkét tábla megvan, minden list/usage pont legalább 2 példával, a form
// tételek a táblákból jönnek, a match egyedi párokból áll, a speak kiegyensúlyozott
// «»-jelöléssel, és a wrong-magyarázatok valódi mondatok, nem egysoros "rossz".

import lessonJson from '@/data/games/grammar/es/ser-estar.json';
import type { LessonV2, LessonBlock } from '@/lib/grammar/lessonTypes';
import type { GrammarGapItem } from '@/lib/games/content';

const lesson = lessonJson as unknown as LessonV2;

const LANGS = ['hu', 'en', 'es', 'de'] as const;

function tablesById(): Record<string, Extract<LessonBlock, { kind: 'table' }>> {
  const out: Record<string, Extract<LessonBlock, { kind: 'table' }>> = {};
  for (const block of lesson.body) {
    if (block.kind === 'table') out[block.id] = block;
  }
  return out;
}

describe('ser-estar.json is a valid LessonV2', () => {
  it('declares schema 2 and has no legacy rule/more fields', () => {
    expect(lesson.schema).toBe(2);
    expect('rule' in lesson).toBe(false);
    expect('more' in lesson).toBe(false);
  });

  it('has both present-tense tables with 6 rows each', () => {
    const tables = tablesById();
    expect(tables['ser-presente']).toBeTruthy();
    expect(tables['estar-presente']).toBeTruthy();
    expect(tables['ser-presente'].rows).toHaveLength(6);
    expect(tables['estar-presente'].rows).toHaveLength(6);
  });

  it('every list/usage point has at least 2 examples', () => {
    for (const block of lesson.body) {
      if (block.kind === 'list' || block.kind === 'usage') {
        const points = block.kind === 'list' ? block.items : block.points;
        for (const point of points) {
          expect(point.examples.length).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });

  it('every contrast pair has a 4-language note and at least 2 examples', () => {
    const contrast = lesson.body.find((b) => b.kind === 'contrast');
    expect(contrast).toBeTruthy();
    if (contrast?.kind !== 'contrast') return;
    for (const pair of contrast.pairs) {
      for (const lang of LANGS) expect(pair.note[lang]).toBeTruthy();
      expect(pair.examples.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("every form item's verb+person is the table row form and equals answer", () => {
    const tables = tablesById();
    const formItems = lesson.items.filter((i) => i.kind === 'form');
    expect(formItems.length).toBeGreaterThanOrEqual(10);
    for (const item of formItems) {
      const table = tables[item.table];
      expect(table).toBeTruthy();
      const row = table.rows.find((r) => r[0] === item.person);
      expect(row).toBeTruthy();
      expect(row?.[1]).toBe(item.answer);
      // a tábla fejlécének 2. oszlopa (az ige) egyezzen az item verb mezőjével
      expect(table.header[1].es).toBe(item.verb);
    }
  });

  it('has one match item with 5-6 unique es/en pairs', () => {
    const matchItems = lesson.items.filter((i) => i.kind === 'match');
    expect(matchItems).toHaveLength(1);
    const match = matchItems[0];
    if (match.kind !== 'match') return;
    expect(match.pairs.length).toBeGreaterThanOrEqual(5);
    expect(match.pairs.length).toBeLessThanOrEqual(6);
    expect(new Set(match.pairs.map((p) => p.es)).size).toBe(match.pairs.length);
    expect(new Set(match.pairs.map((p) => p.en)).size).toBe(match.pairs.length);
  });

  it('speak has all 4 languages, balanced «», no digits or parentheses', () => {
    for (const lang of LANGS) {
      const text = lesson.speak[lang];
      expect(text).toBeTruthy();
      const opens = (text.match(/«/g) ?? []).length;
      const closes = (text.match(/»/g) ?? []).length;
      expect(opens).toBeGreaterThan(0);
      expect(opens).toBe(closes);
      expect(text).not.toMatch(/[0-9]/);
      expect(text).not.toMatch(/[()]/);
    }
  });

  it('every gap item\'s wrong explanations are real sentences in 4 languages', () => {
    const gapItems = lesson.items.filter((i): i is GrammarGapItem => i.kind === undefined) as GrammarGapItem[];
    expect(gapItems.length).toBeGreaterThanOrEqual(10);
    const bareWrong = /^(wrong|rossz|falsch|incorrecto)\.?$/i;
    for (const item of gapItems) {
      for (const optionText of Object.keys(item.wrong)) {
        for (const lang of LANGS) {
          const text = item.wrong[optionText][lang];
          expect(text).toBeTruthy();
          expect(text.length).toBeGreaterThan(40);
          expect(text).not.toMatch(bareWrong);
        }
      }
    }
  });
});
