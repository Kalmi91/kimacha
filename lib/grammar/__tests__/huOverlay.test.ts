// The Hungarian overlay of the grammar courses: withHu lays data/games/grammar-hu/<lang>/<lesson>.json over a
// lesson as the optional `hu` of every Lang4, and the sidecar files themselves stay intact.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { lang4Keys, withHu } from '../huOverlay';

const ROOT = path.join(__dirname, '..', '..', '..');
const COURSES = ['es', 'en'] as const;

const lessonFiles = (lang: string) => fs.readdirSync(path.join(ROOT, 'data', 'games', 'grammar', lang)).filter((f) => f.endsWith('.json')).sort();
const readJson = (...parts: string[]) => JSON.parse(fs.readFileSync(path.join(ROOT, ...parts), 'utf8'));

describe('withHu', () => {
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
  const map = { Title: 'Cím', Text: 'Szöveg', Note: 'Megjegyzés', Hello: 'Szia', house: 'ház' };

  it('sets hu on every Lang4 that has a sidecar entry, nothing else', () => {
    const out = withHu(lesson, map);
    expect(out.title).toEqual({ en: 'Title', es: 'Título', hu: 'Cím' });
    expect(out.body[0]).toEqual({ kind: 'text', text: { en: 'Text', es: 'Texto', hu: 'Szöveg' } });
    const pair = (out.body[1] as { pairs: { note: unknown; examples: { tr: unknown }[] }[] }).pairs[0];
    expect(pair.note).toEqual({ en: 'Note', es: 'Nota', hu: 'Megjegyzés' });
    expect(pair.examples[0].tr).toEqual({ en: 'Hello', es: 'hola', hu: 'Szia' });
    expect(out.topic).toBe('demo');
    expect(out.schema).toBe(2);
  });

  it('skips the literal word pairs of a match item, even when the sidecar has a key for them', () => {
    const out = withHu(lesson, map);
    expect(out.items[0]).toEqual({ kind: 'match', id: 'm', pairs: [{ es: 'casa', en: 'house' }] });
    expect(lang4Keys(lesson)).not.toContain('house');
  });

  it('leaves a Lang4 without a sidecar entry alone, and does not change its input', () => {
    const before = JSON.stringify(lesson);
    const out = withHu(lesson, { Title: 'Cím' });
    expect((out.body[0] as { text: unknown }).text).toEqual({ en: 'Text', es: 'Texto' });
    expect(JSON.stringify(lesson)).toBe(before);
  });

  it('does not take a key like "constructor" from the prototype', () => {
    const out = withHu({ title: { en: 'constructor', es: 'x' } }, {});
    expect(out.title).toEqual({ en: 'constructor', es: 'x' });
  });

  it('is idempotent', () => {
    const once = withHu(lesson, map);
    expect(withHu(once, map)).toEqual(once);
  });
});

describe.each(COURSES)('Hungarian sidecars (%s course)', (lang) => {
  const files = lessonFiles(lang);

  it('there is one sidecar per lesson, and nothing else in the folder', () => {
    const sidecars = fs.readdirSync(path.join(ROOT, 'data', 'games', 'grammar-hu', lang)).sort();
    expect(sidecars).toEqual(files);
  });

  it.each(files)('%s: a flat string -> string object, with at least 95% of the lesson covered and a Hungarian read-aloud', (file) => {
    const map = readJson('data', 'games', 'grammar-hu', lang, file);
    expect(Object.prototype.toString.call(map)).toBe('[object Object]');
    for (const [key, value] of Object.entries(map)) {
      expect(typeof key).toBe('string');
      expect(typeof value).toBe('string');
      expect((value as string).trim()).not.toBe('');
    }
    const lesson = readJson('data', 'games', 'grammar', lang, file);
    const keys = lang4Keys(lesson);
    const covered = keys.filter((k) => Object.prototype.hasOwnProperty.call(map, k)).length;
    expect(covered / keys.length).toBeGreaterThanOrEqual(0.95);
    // the read-aloud text has its own Hungarian version, with balanced «...» marks and no Spanish-only letters
    const speak = withHu(lesson, map).speak.hu as string;
    expect(typeof speak).toBe('string');
    expect(speak.match(/«/g)?.length ?? 0).toBe(speak.match(/»/g)?.length ?? 0);
    expect(speak).not.toMatch(/[ñ¿¡]/);
  });
});

describe('scripts/grammar-hu-check.mjs', () => {
  it('prints the coverage summary and exits 0', () => {
    const out = execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'grammar-hu-check.mjs')], { encoding: 'utf8' });
    expect(out).toMatch(/^TOTAL: 145 lessons, \d+\/\d+ Lang4 covered \(\d+\.\d+%\), \d+ stale$/m);
  });
});
