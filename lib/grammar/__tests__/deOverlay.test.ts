// The German overlay of the grammar courses: withOverlay lays data/games/grammar-de/<course>/<lesson>.json over a
// lesson as the optional `de` of every Lang4 (next to `hu`), the syllabus titles come from
// data/games/grammar-de/syllabus.json, and the sidecar files themselves stay intact.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import deSyllabus from '@/data/games/grammar-de/syllabus.json';
import { getGrammarSyllabus, getGrammarUnits, syllabusForLevel, syllabusLevels, syllabusTopic, topicsForUnit, unitsForLevel } from '../syllabus';
import { EN_SYLLABUS, EN_UNITS } from '../syllabusEn';
import { lang4Keys, withOverlay, withOverlayIndex, withOverlayTitles } from '../overlay';

const ROOT = path.join(__dirname, '..', '..', '..');
const COMPLETE = ['es', 'en'] as const;

const lessonFiles = (course: string) => fs.readdirSync(path.join(ROOT, 'data', 'games', 'grammar', course)).filter((f) => f.endsWith('.json')).sort();
const readJson = (...parts: string[]) => JSON.parse(fs.readFileSync(path.join(ROOT, ...parts), 'utf8'));
const sidecarDir = (course: string) => path.join(ROOT, 'data', 'games', 'grammar-de', course);

describe('withOverlay (de)', () => {
  const lesson = {
    schema: 2,
    topic: 'demo',
    title: { en: 'Title', es: 'Título' },
    body: [
      { kind: 'text', text: { en: 'Text', es: 'Texto' } },
      { kind: 'contrast', pairs: [{ a: 'x', b: 'y', note: { en: 'Note', es: 'Nota' }, examples: [{ es: 'hola', tr: { en: 'Hello', es: 'hola' } }] }] },
    ],
    items: [{ kind: 'match', id: 'm', pairs: [{ es: 'casa', en: 'house' }] }],
  };
  const map = { Title: 'Titel', Text: 'Text auf Deutsch', Note: 'Hinweis', Hello: 'Hallo', house: 'Haus' };

  it('sets de on every Lang4 that has a sidecar entry, nothing else', () => {
    const out = withOverlay(lesson, 'de', map);
    expect(out.title).toEqual({ en: 'Title', es: 'Título', de: 'Titel' });
    expect(out.body[0]).toEqual({ kind: 'text', text: { en: 'Text', es: 'Texto', de: 'Text auf Deutsch' } });
    const pair = (out.body[1] as { pairs: { note: unknown; examples: { tr: unknown }[] }[] }).pairs[0];
    expect(pair.note).toEqual({ en: 'Note', es: 'Nota', de: 'Hinweis' });
    expect(pair.examples[0].tr).toEqual({ en: 'Hello', es: 'hola', de: 'Hallo' });
    expect(out.topic).toBe('demo');
  });

  it('skips the literal word pairs of a match item and does not change its input', () => {
    const before = JSON.stringify(lesson);
    const out = withOverlay(lesson, 'de', map);
    expect(out.items[0]).toEqual({ kind: 'match', id: 'm', pairs: [{ es: 'casa', en: 'house' }] });
    expect(JSON.stringify(lesson)).toBe(before);
  });

  it('can sit next to the Hungarian overlay, in either order, and is idempotent', () => {
    const hu = { Title: 'Cím', Text: 'Szöveg' };
    const a = withOverlay(withOverlay(lesson, 'hu', hu), 'de', map);
    const b = withOverlay(withOverlay(lesson, 'de', map), 'hu', hu);
    expect(a).toEqual(b);
    expect(a.title).toEqual({ en: 'Title', es: 'Título', hu: 'Cím', de: 'Titel' });
    expect(withOverlay(a, 'de', map)).toEqual(a);
    expect(lang4Keys(a)).toEqual(lang4Keys(lesson));
  });

  it('does not take a key like "constructor" from the prototype', () => {
    expect(withOverlay({ title: { en: 'constructor', es: 'x' } }, 'de', {}).title).toEqual({ en: 'constructor', es: 'x' });
  });
});

describe('withOverlayIndex', () => {
  const index = [
    { id: 'a', load: () => ({ title: { en: 'A', es: 'A' } }) },
    { id: 'b', load: () => ({ title: { en: 'B', es: 'B' } }) },
  ];

  it('applies every layer that has a sidecar for the lesson, lazily, and leaves the other lessons as they are', () => {
    let hu = 0;
    let de = 0;
    const out = withOverlayIndex(index as never, [
      { lang: 'hu', sidecars: { a: () => (hu++, { A: 'Á' }) } },
      { lang: 'de', sidecars: { a: () => (de++, { A: 'Ä' }) } },
    ]);
    expect(hu + de).toBe(0);
    expect(out[0].load()).toEqual({ title: { en: 'A', es: 'A', hu: 'Á', de: 'Ä' } });
    expect([hu, de]).toEqual([1, 1]);
    expect(out[1]).toBe(index[1]);
  });
});

describe.each(COMPLETE)('German sidecars (%s course)', (course) => {
  const files = lessonFiles(course);

  it('there is one sidecar per lesson, and nothing else in the folder', () => {
    expect(fs.readdirSync(sidecarDir(course)).sort()).toEqual(files);
  });

  it.each(files)('%s: a flat string -> string object that covers the whole lesson, with a German read-aloud', (file) => {
    const map = readJson('data', 'games', 'grammar-de', course, file);
    expect(Object.prototype.toString.call(map)).toBe('[object Object]');
    for (const [key, value] of Object.entries(map)) {
      expect(typeof key).toBe('string');
      expect(typeof value).toBe('string');
      expect((value as string).trim()).not.toBe('');
      expect(value as string).not.toMatch(/—/);
    }
    const lesson = readJson('data', 'games', 'grammar', course, file);
    const keys = lang4Keys(lesson);
    expect(keys.filter((k) => !Object.prototype.hasOwnProperty.call(map, k))).toEqual([]);
    expect(Object.keys(map).filter((k) => !keys.includes(k))).toEqual([]);
    // the read-aloud text has its own German version, with balanced «...» marks
    const speak = withOverlay(lesson, 'de', map).speak.de as string;
    expect(typeof speak).toBe('string');
    expect(speak.match(/«/g)?.length ?? 0).toBe(speak.match(/»/g)?.length ?? 0);
    expect(speak).not.toMatch(/[ñ¿¡]/);
  });
});

// The Hungarian course takes German sidecars too (written separately): whatever exists must be well formed.
describe('German sidecars (hu course, whatever exists)', () => {
  const present = fs.existsSync(sidecarDir('hu')) ? fs.readdirSync(sidecarDir('hu')).filter((f) => f.endsWith('.json')).sort() : [];
  const lessons = lessonFiles('hu');

  it('every sidecar belongs to a lesson', () => {
    expect(present.filter((f) => !lessons.includes(f))).toEqual([]);
  });

  (present.length ? it.each(present) : it.skip.each(['(none yet)']))('%s: a flat string -> string object that covers at least 95% of the lesson', (file) => {
    const map = readJson('data', 'games', 'grammar-de', 'hu', file);
    for (const [key, value] of Object.entries(map)) {
      expect(typeof key).toBe('string');
      expect(typeof value).toBe('string');
      expect((value as string).trim()).not.toBe('');
    }
    const keys = lang4Keys(readJson('data', 'games', 'grammar', 'hu', file));
    const covered = keys.filter((k) => Object.prototype.hasOwnProperty.call(map, k)).length;
    expect(covered / keys.length).toBeGreaterThanOrEqual(0.95);
  });
});

describe('German syllabus titles', () => {
  it('es course: every unit has a de title, every topic a de title and blurb, and the file has no stray ids', () => {
    const units = getGrammarUnits();
    const topics = getGrammarSyllabus();
    for (const u of units) expect(u.title.de?.trim()).toBeTruthy();
    for (const t of topics) {
      expect(t.title.de?.trim()).toBeTruthy();
      expect(t.blurb.de?.trim()).toBeTruthy();
    }
    expect(Object.keys(deSyllabus.es.units).sort()).toEqual(units.map((u) => u.id).sort());
    expect(Object.keys(deSyllabus.es.topics).sort()).toEqual(topics.map((t) => t.id).sort());
  });

  it('en course: every unit and topic has a de title, and the file has no stray ids', () => {
    for (const u of EN_UNITS) expect(u.title.de?.trim()).toBeTruthy();
    for (const t of EN_SYLLABUS) expect(t.title.de?.trim()).toBeTruthy();
    expect(Object.keys(deSyllabus.en.units).sort()).toEqual(EN_UNITS.map((u) => u.id).sort());
    expect(Object.keys(deSyllabus.en.topics).sort()).toEqual(EN_SYLLABUS.map((t) => t.id).sort());
  });

  it('hu course: every unit has a de title, every topic a de title and blurb, and the file has no stray ids', () => {
    const units = syllabusLevels('hu').flatMap((l) => unitsForLevel(l, 'hu'));
    const topics = syllabusLevels('hu').flatMap((l) => syllabusForLevel(l, 'hu'));
    expect(units).toHaveLength(18);
    expect(topics).toHaveLength(75);
    for (const u of units) expect(u.title.de?.trim()).toBeTruthy();
    for (const t of topics) {
      expect(t.title.de?.trim()).toBeTruthy();
      expect(t.blurb.de?.trim()).toBeTruthy();
    }
    expect(Object.keys(deSyllabus.hu.units).sort()).toEqual(units.map((u) => u.id).sort());
    expect(Object.keys(deSyllabus.hu.topics).sort()).toEqual(topics.map((t) => t.id).sort());
  });

  it('a topic whose list title and lesson title agree in English agrees in German too (list row = lesson header)', () => {
    const huTopics = syllabusLevels('hu').flatMap((l) => syllabusForLevel(l, 'hu'));
    for (const [course, topics] of [['es', getGrammarSyllabus()], ['en', EN_SYLLABUS], ['hu', huTopics]] as const) {
      for (const t of topics) {
        const file = [t.id, t.id.replace(/_/g, '-')].find((f) => fs.existsSync(path.join(ROOT, `data/games/grammar/${course}/${f}.json`)));
        if (!file) continue;
        const en = readJson(`data/games/grammar/${course}/${file}.json`).title?.en;
        if (en !== t.title.en) continue;
        expect([course, t.id, t.title.de]).toEqual([course, t.id, readJson(`data/games/grammar-de/${course}/${file}.json`)[en]]);
      }
    }
  });

  it('has no em dash and is reachable through the syllabus API next to the hu titles', () => {
    expect(JSON.stringify(deSyllabus)).not.toMatch(/—/);
    const serEstar = syllabusTopic('ser-estar', 'es')!;
    expect(serEstar.title.de).toBe('Ser oder estar?');
    expect(serEstar.title.hu).toBe('Ser vagy estar?');
    expect(serEstar.title.en).toBe('Ser or estar?');
    expect(syllabusTopic('to_be', 'en')!.title.de).toBeTruthy();
    expect(unitsForLevel('A1', 'en')[0].title.de).toBe('Erste Schritte');
    expect(unitsForLevel('A1', 'hu')[0].title.de).toBe('Laute und Vokalharmonie');
    expect(syllabusTopic('lenni-van', 'hu')!.title.de).toBe('Sein: vagyok, vagy, van');
    expect(syllabusTopic('lenni-van', 'hu')!.title.en).toBe('To be: vagyok, vagy, van');
    for (const t of topicsForUnit('a1-presente', 'es')) expect(t.title.de).toBeTruthy();
  });

  it('withOverlayTitles leaves an id without an entry alone and only adds a blurb where the entry has one', () => {
    const entries: { id: string; title: Record<string, string>; blurb?: Record<string, string> }[] = [
      { id: 'a', title: { en: 'A', es: 'A' }, blurb: { en: 'a', es: 'a' } },
      { id: 'b', title: { en: 'B', es: 'B' }, blurb: {} },
      { id: 'c', title: { en: 'C', es: 'C' } },
    ];
    const out = withOverlayTitles(entries, 'de', { a: { title: 'Ä', blurb: 'ä' }, b: 'Bé' });
    expect(out[0]).toEqual({ id: 'a', title: { en: 'A', es: 'A', de: 'Ä' }, blurb: { en: 'a', es: 'a', de: 'ä' } });
    expect(out[1]).toEqual({ id: 'b', title: { en: 'B', es: 'B', de: 'Bé' }, blurb: {} });
    expect(out[2]).toBe(entries[2]);
    expect(entries[0].title).toEqual({ en: 'A', es: 'A' });
  });
});

describe('scripts/grammar-de-check.mjs', () => {
  it('prints the coverage summary and exits 0 with --strict while es and en are complete', () => {
    const out = execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'grammar-de-check.mjs'), '--strict'], { encoding: 'utf8' });
    expect(out).toMatch(/^es: 87 lessons, \d+\/\d+ Lang4 covered \(100\.00%\), 0 stale$/m);
    expect(out).toMatch(/^en: 63 lessons, \d+\/\d+ Lang4 covered \(100\.00%\), 0 stale$/m);
    expect(out).toMatch(/^TOTAL: \d+ lessons, \d+\/\d+ Lang4 covered \(\d+\.\d+%\), \d+ stale$/m);
  });
});
