import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { CORPUS_NAMES } from '../corpusNames';
import { capitalizedWords } from '../properNames';

const ROOT = path.join(__dirname, '..', '..');
type Lang = 'es' | 'en' | 'hu';

describe('capitalizedWords', () => {
  it('marks the capital at the start of a sentence, after an end mark and after an opening quote', () => {
    expect(capitalizedWords('Tom and Ana saw "Pedro" at Madrid. Then Luis left.')).toEqual([
      { word: 'Tom', initial: true },
      { word: 'Ana', initial: false },
      { word: 'Pedro', initial: true },
      { word: 'Madrid', initial: false },
      { word: 'Then', initial: true },
      { word: 'Luis', initial: false },
    ]);
  });

  it('reads the Spanish question and exclamation marks as sentence openers', () => {
    expect(capitalizedWords('¿Cómo está Ana? ¡Qué bien!')).toEqual([
      { word: 'Cómo', initial: true },
      { word: 'Ana', initial: false },
      { word: 'Qué', initial: true },
    ]);
  });

  it('keeps the suffix of a Hungarian name and the possessive of an English one, and skips lowercase and digits', () => {
    expect(capitalizedWords('Anna Budapesten él, 3 nap.')).toEqual([
      { word: 'Anna', initial: true },
      { word: 'Budapesten', initial: false },
    ]);
    expect(capitalizedWords("It is Tom's dog.")).toEqual([
      { word: 'It', initial: true },
      { word: "Tom's", initial: false },
    ]);
  });

  it('does not let a stray punctuation chunk reset the sentence start', () => {
    expect(capitalizedWords('Hello - Tom')).toEqual([
      { word: 'Hello', initial: true },
      { word: 'Tom', initial: false },
    ]);
  });
});

describe('the corpus name list', () => {
  const sentences: Record<Lang, string[]> = { es: [], en: [], hu: [] };
  const walk = (value: unknown, stories: boolean): void => {
    if (Array.isArray(value)) return value.forEach((v) => walk(v, stories));
    if (!value || typeof value !== 'object') return;
    for (const [key, v] of Object.entries(value)) {
      const own = /^sentence_(es|en|hu)$/.exec(key);
      if (own && typeof v === 'string') sentences[own[1] as Lang].push(v);
      else if (stories && (key === 'es' || key === 'en' || key === 'hu') && typeof v === 'string') sentences[key].push(v);
      else walk(v, stories);
    }
  };
  const scan = (dir: string, stories: boolean): void => {
    for (const name of fs.readdirSync(dir)) {
      const file = path.join(dir, name);
      if (fs.statSync(file).isDirectory()) scan(file, stories);
      else if (name.endsWith('.json') && (!stories || name.startsWith('stories'))) walk(JSON.parse(fs.readFileSync(file, 'utf8')), stories);
    }
  };
  scan(path.join(ROOT, 'data', 'words'), false);
  scan(path.join(ROOT, 'data', 'words-open'), false);
  scan(path.join(ROOT, 'data', 'practice'), true);

  it('is up to date (npm run gen:names)', () => {
    const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'gen-corpus-names.mjs'), '--check'], { encoding: 'utf8' });
    expect(`${r.stdout}${r.stderr}`).not.toMatch(/out of date/);
    expect(r.status).toBe(0);
  });

  it.each(['es', 'en', 'hu'] as const)('has only names that capitalizedWords finds inside a sentence of the corpus (%s)', (lang) => {
    const inside = new Set<string>();
    for (const sentence of sentences[lang]) {
      for (const w of capitalizedWords(sentence)) if (!w.initial) inside.add(w.word.toLowerCase());
    }
    expect(CORPUS_NAMES[lang].filter((name) => !inside.has(name))).toEqual([]);
    expect(CORPUS_NAMES[lang].length).toBeGreaterThan(0);
  });

  it('keeps out a word the corpus also writes in lowercase and keeps a real name', () => {
    expect(CORPUS_NAMES.es).toContain('tom');
    expect(CORPUS_NAMES.en).toContain('tom');
    expect(CORPUS_NAMES.en).not.toContain('will');
  });
});
