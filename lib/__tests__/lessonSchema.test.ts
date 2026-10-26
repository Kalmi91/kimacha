// Structural check of EVERY schema 2 lesson (after the ser-estar
// pilot the lessons of the core+ band use this schema too). It does not measure the
// pedagogical correctness of the content (that is for human review), only whether the JSON
// keeps the spec's mandatory structural promises: there is a table wherever there are forms,
// every list/usage point has at least 2 examples, form items come from the tables
// (from the verb column in tables with several verbs), match consists of unique pairs, speak
// has balanced «» markup, and the wrong explanations are real sentences, not a
// one-line "wrong".

import fs from 'fs';
import path from 'path';
import type { LessonV2, LessonBlock } from '@/lib/grammar/lessonTypes';
import { TENSE_IDS, TENSE_NAMES } from '@/lib/grammar/lessonTypes';
import type { GrammarGapItem } from '@/lib/games/content';
import { findWholeWord } from '@/lib/grammar/whyTarget';

const LANGS = ['en', 'es'] as const;
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

// A badge name for every tense, in both
// languages, so that TENSE_NAMES is not silently incomplete.
describe('TENSE_IDS', () => {
  it('matches the copy in scripts/audit-games.mjs (the script cannot import the TS file)', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'scripts', 'audit-games.mjs'), 'utf8');
    const m = src.match(/const TENSE_IDS = \[([\s\S]*?)\];/);
    expect(m).toBeTruthy();
    const ids = [...m![1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    expect(ids).toEqual([...TENSE_IDS]);
  });
});

describe('TENSE_NAMES', () => {
  it('gives both non-empty languages for every tense', () => {
    for (const tense of TENSE_IDS) {
      for (const lang of LANGS) {
        expect(TENSE_NAMES[tense][lang]?.trim()).toBeTruthy();
      }
    }
  });

  it('has a Hungarian name for every tense (hu→es and hu→en learners)', () => {
    for (const tense of TENSE_IDS) {
      expect(TENSE_NAMES[tense].hu?.trim()).toBeTruthy();
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
    // the body of a transform lesson (e.g. indefinido-10-verbos) is text+table+tip,
    // with no list/usage/examples/contrast block, hence no example pair either. We allow this only on
    // lessons that contain a transform item; the older lessons keep the strict rule.
    if (lesson.items.some((i) => i.kind === 'transform')) return;
    expect(pairs.length).toBeGreaterThan(0);
    for (const pair of pairs) {
      expect(pair.tr.en).toBeTruthy();
      expect(pair.tr.en.trim()).not.toBe(pair.es.trim());
    }
  });

  it('every contrast pair has a note in both languages and at least 2 examples', () => {
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
      // multi-verb table: the verb column comes from the header's `es` cell; for a single-verb table it is the 2nd column.
      const verbCol = table.header.findIndex((h, ci) => ci > 0 && h.es === item.verb);
      const col = verbCol > 0 ? verbCol : 1;
      expect(table.header[col].es).toBe(item.verb);
      expect(row?.[col]).toBe(item.answer);
    }
  });

  it('has 1-2 match items with 5-6 unique es/en pairs', () => {
    // a transform lesson (e.g. indefinido-10-verbos) has no gap-based content,
    // hence no match pair either; the older lessons keep the strict rule.
    if (lesson.items.some((i) => i.kind === 'transform')) return;
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

  it('speak has both languages, no «» sections (read aloud without Spanish), no digits or parentheses', () => {
    for (const lang of LANGS) {
      const text = lesson.speak[lang];
      expect(text).toBeTruthy();
      const opens = (text.match(/«/g) ?? []).length;
      const closes = (text.match(/»/g) ?? []).length;
      // in the read-aloud text of the Spanish lessons there is no marked Spanish section.
      expect(opens).toBe(0);
      expect(opens).toBe(closes);
      expect(text).not.toMatch(/[0-9]/);
      expect(text).not.toMatch(/[()]/);
    }
  });

  // "why this sentence": the audit rules for these items, plus:
  // the text of the correct option does not appear verbatim in the sentence (otherwise the
  // task would give itself away).
  it('why items (once authored) are 6-8, each with 3 unique-en options and a translated sentence', () => {
    const whyItems = lesson.items.filter((i) => i.kind === 'why');
    // the content is added lesson by lesson, in batches, AFTER the commit
    // that closes the code; a still untouched lesson has 0 why items, which is fine.
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

      const enTexts = item.options.map((o) => o.text.en);
      expect(new Set(enTexts).size).toBe(3);

      const esLower = item.es.toLowerCase();
      item.options.forEach((opt, i) => {
        for (const lang of LANGS) expect(opt.text[lang]).toBeTruthy();
        if (i === item.correctIndex && opt.text.es) {
          // The correct option (the rule's name) must not appear verbatim in the sentence.
          expect(esLower).not.toContain(opt.text.es.toLowerCase());
        }
        if (i !== item.correctIndex) {
          expect(opt.wrong).toBeTruthy();
          for (const lang of LANGS) expect(opt.wrong?.[lang]).toBeTruthy();
        }
      });

      // if there is a `target`, it must appear in the `es` sentence as a whole word.
      if (item.target) {
        expect(findWholeWord(item.es, item.target)).not.toBeNull();
      }
    }
  });

  // the transform items (0/0 for now on an empty corpus, live afterwards).
  it('every transform item has a real prompt/answer pair and known words', () => {
    const transformItems = lesson.items.filter((i) => i.kind === 'transform');
    for (const item of transformItems) {
      if (item.kind !== 'transform') continue;
      expect(item.prompt.es.trim()).not.toBe(item.answer.trim());
      expect(item.tense.from).not.toBe(item.tense.to);
      expect(item.wordIds.length).toBeGreaterThan(0);
    }
  });

  it("every gap item's wrong explanations are real sentences in both languages", () => {
    const gapItems = lesson.items.filter((i): i is GrammarGapItem => i.kind === undefined) as GrammarGapItem[];
    // a transform lesson (e.g. indefinido-10-verbos) has no gap-based content;
    // the older lessons (no transform item) keep the strict rule.
    if (lesson.items.some((i) => i.kind === 'transform')) return;
    expect(gapItems.length).toBeGreaterThanOrEqual(10);
    const bareWrong = /^(wrong|incorrecto)\.?$/i;
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

// The Hungarian course (target hu, es→hu and en→hu): the same schema 2, but the learned language
// (Hungarian) sits in the `es`-named fields, `tr` holds the English and Spanish translations (there is
// no hu side), the read-aloud text MARKS the Hungarian snippets with «...», and the lessons are choice /
// form / why only. The form items' `table` is a pattern hint, not a conjugation row to look up.
const HU_DIR = path.join(__dirname, '..', '..', 'data', 'games', 'grammar', 'hu');
const huLessons: [string, LessonV2][] = fs
  .readdirSync(HU_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => [f, JSON.parse(fs.readFileSync(path.join(HU_DIR, f), 'utf8')) as LessonV2] as [string, LessonV2]);

describe('Hungarian course lessons', () => {
  it('are the 75 lessons of the course', () => {
    expect(huLessons).toHaveLength(75);
  });
});

describe.each(huLessons)('hu/%s is a valid LessonV2', (file, lesson) => {
  it('declares schema 2, its topic is the file name, level A1 to C1, no legacy fields', () => {
    expect(lesson.schema).toBe(2);
    expect(lesson.topic).toBe(file.replace(/\.json$/, ''));
    expect(['A1', 'A2', 'B1', 'B2', 'C1']).toContain(lesson.level);
    expect('rule' in lesson).toBe(false);
    expect('more' in lesson).toBe(false);
    for (const lang of LANGS) expect(lesson.title[lang]).toBeTruthy();
  });

  it('has a table with equal-width rows, and every list/usage point has at least 2 examples with translations', () => {
    const tables = Object.values(tablesById(lesson));
    expect(tables.length).toBeGreaterThanOrEqual(1);
    for (const table of tables) {
      for (const lang of LANGS) expect(table.title[lang]).toBeTruthy();
      expect(table.header.length).toBeGreaterThanOrEqual(1); // a word list may be one column wide (tagadas)
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

  it('is choice, form and why only: 14 choice (B1-C1: at least 14), 12 form, 4 why, every id unique', () => {
    const kinds = lesson.items.map((i) => i.kind ?? 'choice');
    expect(new Set(kinds)).toEqual(new Set(['choice', 'form', 'why']));
    const choices = kinds.filter((k) => k === 'choice');
    if (['A1', 'A2'].includes(lesson.level)) expect(choices).toHaveLength(14);
    else expect(choices.length).toBeGreaterThanOrEqual(14);
    expect(kinds.filter((k) => k === 'form')).toHaveLength(12);
    expect(kinds.filter((k) => k === 'why')).toHaveLength(4);
    const ids = lesson.items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('read-aloud text: both languages, Hungarian snippets marked «...», no digits or parentheses', () => {
    for (const lang of LANGS) {
      const text = lesson.speak[lang];
      expect(text).toBeTruthy();
      const opens = (text.match(/«/g) ?? []).length;
      expect(opens).toBeGreaterThan(0);
      expect(opens).toBe((text.match(/»/g) ?? []).length);
      expect(text).not.toMatch(/[0-9]/);
      expect(text).not.toMatch(/[()]/);
    }
  });

  it("every form item names an existing table and has a Hungarian answer (no cell lookup)", () => {
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

  it("every choice item has 3 options, one gap, a translation, and a real wrong explanation for each wrong option in both languages", () => {
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
