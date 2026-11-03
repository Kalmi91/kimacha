// Structural check of every lesson of the German course (target de, es→de / en→de / hu→de): schema 2, the learned
// language (German) sits in the `es`-named fields, `tr` holds the English and Spanish translations (Hungarian comes from
// the sidecar), the read-aloud text MARKS the German snippets with «...», and the lessons are choice / form / why only.
// Twin of the Hungarian block of lessonSchema.test.ts. The lessons are counted from the files (6 today, 75 when the course
// is complete), never hard-coded. The wording quality of the lessons is the job of scripts/grammar-de-course-check.mjs.

import fs from 'fs';
import path from 'path';
import type { LessonV2, LessonBlock } from '@/lib/grammar/lessonTypes';
import type { GrammarGapItem } from '@/lib/games/content';
import { findWholeWord } from '@/lib/grammar/whyTarget';

const LANGS = ['en', 'es'] as const;
const ROOT = path.join(__dirname, '..', '..');
const DE_DIR = path.join(ROOT, 'data', 'games', 'grammar', 'de');
const HU_SIDECARS = path.join(ROOT, 'data', 'games', 'grammar-hu', 'de');

type TableBlock = Extract<LessonBlock, { kind: 'table' }>;

const deLessons: [string, LessonV2][] = fs
  .readdirSync(DE_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => [f, JSON.parse(fs.readFileSync(path.join(DE_DIR, f), 'utf8')) as LessonV2] as [string, LessonV2]);

function tablesById(lesson: LessonV2): Record<string, TableBlock> {
  const out: Record<string, TableBlock> = {};
  for (const block of lesson.body) {
    if (block.kind === 'table') out[block.id] = block;
  }
  return out;
}

describe('German course lessons', () => {
  it('are lessons of the syllabus (at most 75), and the first A1 lessons exist', () => {
    expect(deLessons.length).toBeGreaterThanOrEqual(6);
    expect(deLessons.length).toBeLessThanOrEqual(75);
    const names = deLessons.map(([f]) => f);
    expect(names).toContain('aussprache-umlaute.json');
    expect(names).toContain('artikel-genus.json');
  });
});

describe.each(deLessons)('de/%s is a valid LessonV2', (file, lesson) => {
  it('declares schema 2, its topic is the file name, level A1 to C1, no legacy fields', () => {
    expect(lesson.schema).toBe(2);
    expect(lesson.topic).toBe(file.replace(/\.json$/, ''));
    expect(['A1', 'A2', 'B1', 'B2', 'C1']).toContain(lesson.level);
    expect('rule' in lesson).toBe(false);
    expect('more' in lesson).toBe(false);
    for (const lang of LANGS) expect(lesson.title[lang]).toBeTruthy();
  });

  it('has a body, a table with equal-width rows, and every list/usage point has at least 2 examples with translations', () => {
    expect(lesson.body.length).toBeGreaterThanOrEqual(3);
    const tables = Object.values(tablesById(lesson));
    expect(tables.length).toBeGreaterThanOrEqual(1);
    for (const table of tables) {
      for (const lang of LANGS) expect(table.title[lang]).toBeTruthy();
      expect(table.header.length).toBeGreaterThanOrEqual(1);
      for (const row of table.rows) expect(row).toHaveLength(table.header.length);
    }
    for (const block of lesson.body) {
      if (block.kind !== 'list' && block.kind !== 'usage') continue;
      const points = block.kind === 'list' ? block.items : block.points;
      for (const point of points) {
        expect(point.examples.length).toBeGreaterThanOrEqual(2);
        for (const ex of point.examples) {
          expect(ex.es.trim()).toBeTruthy();
          for (const lang of LANGS) expect(ex.tr[lang]).toBeTruthy();
        }
      }
    }
  });

  it('is choice, form and why only: 14 choice, 12 form, 4 why, every id unique', () => {
    const kinds = lesson.items.map((i) => i.kind ?? 'choice');
    expect(new Set(kinds)).toEqual(new Set(['choice', 'form', 'why']));
    expect(kinds.filter((k) => k === 'choice')).toHaveLength(14);
    expect(kinds.filter((k) => k === 'form')).toHaveLength(12);
    expect(kinds.filter((k) => k === 'why')).toHaveLength(4);
    const ids = lesson.items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('read-aloud text: both languages and the Hungarian sidecar, German snippets marked «...», no digits or parentheses', () => {
    const sidecar = JSON.parse(fs.readFileSync(path.join(HU_SIDECARS, file), 'utf8')) as Record<string, string>;
    const texts = [lesson.speak.en, lesson.speak.es, sidecar[lesson.speak.en]];
    for (const text of texts) {
      expect(text).toBeTruthy();
      const opens = (text.match(/«/g) ?? []).length;
      expect(opens).toBeGreaterThan(0);
      expect(opens).toBe((text.match(/»/g) ?? []).length);
      expect(text).not.toMatch(/[0-9]/);
      expect(text).not.toMatch(/[()]/);
    }
  });

  it('every form item names an existing table and has a German answer (no cell lookup, the table is the hint)', () => {
    const tables = tablesById(lesson);
    for (const item of lesson.items) {
      if (item.kind !== 'form') continue;
      expect(tables[item.table]).toBeTruthy();
      expect(item.verb.trim()).toBeTruthy();
      expect(item.person.trim()).toBeTruthy();
      expect(item.answer.trim()).toBeTruthy();
      expect(item.accept ?? []).not.toContain(item.answer);
    }
  });

  it('every choice item has 3 options, one gap, a translation, and a real wrong explanation for each wrong option in both languages', () => {
    for (const item of lesson.items) {
      if (item.kind !== undefined) continue;
      const gap = item as GrammarGapItem;
      expect(gap.options).toHaveLength(3);
      expect(new Set(gap.options).size).toBe(3);
      expect(gap.correct).toBeGreaterThanOrEqual(0);
      expect(gap.correct).toBeLessThan(3);
      expect(gap.sentence.split('___')).toHaveLength(2);
      for (const lang of LANGS) {
        expect(gap.why[lang]).toBeTruthy();
        expect(gap.tr?.[lang]).toBeTruthy();
      }
      gap.options.forEach((opt, i) => {
        if (i === gap.correct) return;
        for (const lang of LANGS) expect(gap.wrong[opt]?.[lang]?.length).toBeGreaterThan(20);
      });
    }
  });

  it('every why item has 3 options with a unique English text, a target in the sentence and translations', () => {
    for (const item of lesson.items) {
      if (item.kind !== 'why') continue;
      expect(item.es.trim()).toBeTruthy();
      for (const lang of LANGS) expect(item.tr[lang]).toBeTruthy();
      expect(item.options).toHaveLength(3);
      expect(item.correctIndex).toBeGreaterThanOrEqual(0);
      expect(item.correctIndex).toBeLessThan(3);
      expect(new Set(item.options.map((o) => o.text.en)).size).toBe(3);
      item.options.forEach((opt, i) => {
        for (const lang of LANGS) expect(opt.text[lang]).toBeTruthy();
        if (i !== item.correctIndex) for (const lang of LANGS) expect(opt.wrong?.[lang]).toBeTruthy();
      });
      if (item.target) expect(findWholeWord(item.es, item.target)).not.toBeNull();
    }
  });
});
