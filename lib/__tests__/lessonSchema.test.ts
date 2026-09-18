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
import { TENSE_IDS, TENSE_NAMES } from '@/lib/grammar/lessonTypes';
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

// NY1 (NYELVTAN.md "Adatformátum"): a jelvény-név minden igeidőre, mind a 4
// nyelven, hogy a TENSE_NAMES ne legyen csendben hiányos.
describe('TENSE_NAMES', () => {
  it('gives all 4 non-empty languages for every tense', () => {
    for (const tense of TENSE_IDS) {
      for (const lang of ['hu', 'en', 'es', 'de'] as const) {
        expect(TENSE_NAMES[tense][lang]?.trim()).toBeTruthy();
      }
    }
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

  it('every example translation is a translation, not the Spanish sentence again', () => {
    const pairs: { es: string; tr: Record<string, string> }[] = [];
    const collect = (o: unknown) => {
      if (Array.isArray(o)) o.forEach(collect);
      else if (o && typeof o === 'object') {
        const rec = o as Record<string, unknown>;
        if (typeof rec.es === 'string' && rec.tr && typeof rec.tr === 'object') {
          pairs.push(rec as { es: string; tr: Record<string, string> });
        }
        Object.values(rec).forEach(collect);
      }
    };
    collect(lesson.body);
    // NY4: a transform-only lecke (indefinido-10-verbos) body-ja text+table+tip,
    // nincs list/usage/examples/contrast blokk, tehát nincs is példapár.
    const hasExampleBearingBlock = lesson.body.some((b) =>
      ['list', 'usage', 'examples', 'contrast'].includes(b.kind),
    );
    if (!hasExampleBearingBlock) return;
    expect(pairs.length).toBeGreaterThan(0);
    for (const pair of pairs) {
      for (const lang of ['hu', 'en', 'de'] as const) {
        expect(pair.tr[lang]).toBeTruthy();
        expect(pair.tr[lang].trim()).not.toBe(pair.es.trim());
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
    // NY4: a transform-only lecke (indefinido-10-verbos) nem gap-alapú, nincs match párja.
    const gapItemCount = lesson.items.filter((i) => i.kind === undefined).length;
    if (gapItemCount === 0) return;
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

  // TASK-8 (D4, FB288): "miért ez a mondat", a 3. audit-pont szabályai, plusz:
  // a jó opció szövege nem szerepel szó szerint a mondatban (különben a
  // feladat elárulná magát).
  it('why items (once authored) are 6-8, each with 3 unique-hu options and a translated sentence', () => {
    const whyItems = lesson.items.filter((i) => i.kind === 'why');
    // TASK-8: a tartalom leckénként, adagolva kerül be a kódot lezáró commit
    // UTÁN (B szakasz); egy még érintetlen leckén 0 why item van, ez rendben.
    if (whyItems.length === 0) return;
    expect(whyItems.length).toBeGreaterThanOrEqual(6);
    expect(whyItems.length).toBeLessThanOrEqual(8);
    const seenIds = new Set<string>();
    for (const item of whyItems) {
      if (item.kind !== 'why') continue;
      expect(seenIds.has(item.id)).toBe(false);
      seenIds.add(item.id);

      expect(item.es.trim().length).toBeGreaterThan(0);
      expect(item.tr.es).toBe(item.es);
      for (const lang of LANGS) expect(item.tr[lang]).toBeTruthy();

      expect(item.options).toHaveLength(3);
      expect(item.correctIndex).toBeGreaterThanOrEqual(0);
      expect(item.correctIndex).toBeLessThan(3);

      const huTexts = item.options.map((o) => o.text.hu);
      expect(new Set(huTexts).size).toBe(3);

      const esLower = item.es.toLowerCase();
      item.options.forEach((opt, i) => {
        for (const lang of LANGS) expect(opt.text[lang]).toBeTruthy();
        if (i === item.correctIndex && opt.text.es) {
          // A jó opció (a szabály neve) ne szerepeljen szó szerint a mondatban.
          expect(esLower).not.toContain(opt.text.es.toLowerCase());
        }
        if (i !== item.correctIndex) {
          expect(opt.wrong).toBeTruthy();
          for (const lang of LANGS) expect(opt.wrong?.[lang]).toBeTruthy();
        }
      });
    }
  });

  // NY1: a transform item (üres korpuszon most 0/0, NY4 után éles).
  it('every transform item has a real prompt/answer pair and known words', () => {
    const transformItems = lesson.items.filter((i) => i.kind === 'transform');
    for (const item of transformItems) {
      if (item.kind !== 'transform') continue;
      expect(item.prompt.es.trim()).not.toBe(item.answer.trim());
      expect(item.tense.from).not.toBe(item.tense.to);
      expect(item.wordIds.length).toBeGreaterThan(0);
    }
  });

  it("every gap item's wrong explanations are real sentences in 4 languages", () => {
    const gapItems = lesson.items.filter((i): i is GrammarGapItem => i.kind === undefined) as GrammarGapItem[];
    // NY4: a transform-only lecke (indefinido-10-verbos) nem gap-alapú, 0 elemen is rendben.
    if (gapItems.length === 0) return;
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
