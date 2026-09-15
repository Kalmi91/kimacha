// LECKE-SEMA 1-2. szakasz: MINDEN schema 2 lecke szerkezeti ellenőrzése (a pilot
// ser-estar után a core+ sáv leckéi is ezen a sémán vannak). Nem a tartalom
// pedagógiai helyességét méri (az emberi felülvizsgálat dolga), hanem hogy a JSON
// tartja-e a spec kötelező szerkezeti ígéreteit: van tábla, ahol alakok vannak,
// minden list/usage pont legalább 2 példával, a form tételek a táblákból jönnek
// (több igés táblánál az ige oszlopából), a match egyedi párokból áll, a speak
// kiegyensúlyozott «»-jelöléssel, és a wrong-magyarázatok valódi mondatok, nem
// egysoros "rossz".

import fs from 'fs';
import path from 'path';
import type { LessonV2, LessonBlock } from '@/lib/grammar/lessonTypes';
import type { GrammarGapItem } from '@/lib/games/content';

const LANGS = ['hu', 'en', 'es', 'de'] as const;
const DIR = path.join(__dirname, '..', '..', 'data', 'games', 'grammar', 'es');

type TableBlock = Extract<LessonBlock, { kind: 'table' }>;

const lessons: [string, LessonV2][] = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => [f, JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) as LessonV2] as [string, LessonV2])
  .filter(([, l]) => l.schema === 2);

function tablesById(lesson: LessonV2): Record<string, TableBlock> {
  const out: Record<string, TableBlock> = {};
  for (const block of lesson.body) {
    if (block.kind === 'table') out[block.id] = block;
  }
  return out;
}

describe('schema 2 lessons', () => {
  it('the pilot and the core+ lessons are on schema 2', () => {
    const names = lessons.map(([f]) => f);
    expect(names).toContain('ser-estar.json');
    expect(names).toContain('presente-regular.json');
  });
});

describe.each(lessons)('%s is a valid LessonV2', (_file, lesson) => {
  it('declares schema 2 and has no legacy rule/more fields', () => {
    expect(lesson.schema).toBe(2);
    expect('rule' in lesson).toBe(false);
    expect('more' in lesson).toBe(false);
  });

  it('every table has a title, a header and at least one row of equal width', () => {
    for (const table of Object.values(tablesById(lesson))) {
      for (const lang of LANGS) expect(table.title[lang]).toBeTruthy();
      expect(table.header.length).toBeGreaterThanOrEqual(2);
      expect(table.rows.length).toBeGreaterThanOrEqual(1);
      for (const row of table.rows) expect(row).toHaveLength(table.header.length);
    }
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
    for (const block of lesson.body) {
      if (block.kind !== 'contrast') continue;
      for (const pair of block.pairs) {
        for (const lang of LANGS) expect(pair.note[lang]).toBeTruthy();
        expect(pair.examples.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("every form item's verb+person is the table cell and equals answer", () => {
    const tables = tablesById(lesson);
    const formItems = lesson.items.filter((i) => i.kind === 'form');
    for (const item of formItems) {
      if (item.kind !== 'form') continue;
      const table = tables[item.table];
      expect(table).toBeTruthy();
      const row = table.rows.find((r) => r[0] === item.person);
      expect(row).toBeTruthy();
      // több igés tábla: az ige oszlopa a fejléc `es` cellájából; egy igésnél a 2.
      const verbCol = table.header.findIndex((h, ci) => ci > 0 && h.es === item.verb);
      const col = verbCol > 0 ? verbCol : 1;
      expect(table.header[col].es).toBe(item.verb);
      expect(row?.[col]).toBe(item.answer);
    }
  });

  it('has 1-2 match items with 5-6 unique es/en pairs', () => {
    const matchItems = lesson.items.filter((i) => i.kind === 'match');
    expect(matchItems.length).toBeGreaterThanOrEqual(1);
    expect(matchItems.length).toBeLessThanOrEqual(2);
    for (const match of matchItems) {
      if (match.kind !== 'match') continue;
      expect(match.pairs.length).toBeGreaterThanOrEqual(5);
      expect(match.pairs.length).toBeLessThanOrEqual(6);
      expect(new Set(match.pairs.map((p) => p.es)).size).toBe(match.pairs.length);
      expect(new Set(match.pairs.map((p) => p.en)).size).toBe(match.pairs.length);
    }
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

  it("every gap item's wrong explanations are real sentences in 4 languages", () => {
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
