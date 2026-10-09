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

// A badge name for every tense, in all 4
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
    // the body of a transform lesson (e.g. indefinido-10-verbos) is text+table+tip,
    // with no list/usage/examples/contrast block, hence no example pair either. We allow this only on
    // lessons that contain a transform item; the older lessons keep the strict rule.
    if (lesson.items.some((i) => i.kind === 'transform')) return;
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

  it('speak has all 4 languages, no «» sections (FB414: read aloud without Spanish), no digits or parentheses', () => {
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
  it('why items (once authored) are 6-8, each with 3 unique-hu options and a translated sentence', () => {
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

      const huTexts = item.options.map((o) => o.text.hu);
      expect(new Set(huTexts).size).toBe(3);

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

  it("every gap item's wrong explanations are real sentences in 4 languages", () => {
    const gapItems = lesson.items.filter((i): i is GrammarGapItem => i.kind === undefined) as GrammarGapItem[];
    // a transform lesson (e.g. indefinido-10-verbos) has no gap-based content;
    // the older lessons (no transform item) keep the strict rule.
    if (lesson.items.some((i) => i.kind === 'transform')) return;
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
