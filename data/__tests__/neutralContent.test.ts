// The app is for learners worldwide: outside the Hungarian course, what a learner reads in English, Spanish or German
// names no Hungary, Hungarian word or surname, and nothing from the author's own life. The Hungarian texts are exempt
// (`hu` / `*_hu` fields, grammar-hu sidecars, the courses where Hungarian is the target), a Hungarian speaker reads those.
import fs from 'node:fs';
import path from 'node:path';

const DATA = path.join(__dirname, '..');
const FORBIDDEN = /hungar|ungar|húngar|hungr[ií]a|budapest|magyar|pálinka|kov[aá]cs|berenice|[őŐűŰ]/i;
// `keywords` only score a spoken answer and are never shown; a learner may well say they are from Hungary.
const EXEMPT_KEY = /(^|_)hu$|^keywords$/;

const jsonFiles = (dir: string, only: RegExp = /\.json$/): string[] =>
  fs
    .readdirSync(path.join(DATA, dir))
    .filter((f) => only.test(f))
    .map((f) => path.join(dir, f));

const SOURCES = [
  ...['es', 'en', 'de'].flatMap((course) => jsonFiles(path.join('games/grammar', course))),
  ...['es', 'en'].flatMap((course) => jsonFiles(path.join('games/grammar-de', course))),
  ...jsonFiles('practice', /^(situations|situations-de|stories|stories-en|stories-de)\.json$/),
  ...jsonFiles('speech'),
  ...jsonFiles('words/de'),
  ...jsonFiles('words/en'),
  ...jsonFiles('words-open'),
  ...jsonFiles('exams/mock', /^(es|en|de)-.*\.json$/),
];

function hitsIn(value: unknown, where: string, out: string[]): void {
  if (typeof value === 'string') {
    if (FORBIDDEN.test(value)) out.push(`${where}: ${value.slice(0, 80)}`);
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => hitsIn(v, `${where}.${i}`, out));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (EXEMPT_KEY.test(k)) continue;
      // a sidecar is keyed by the English text, so the keys are learner-facing content as well
      if (FORBIDDEN.test(k)) out.push(`${where} (key): ${k.slice(0, 80)}`);
      hitsIn(v, `${where}.${k}`, out);
    }
  }
}

describe('learner-facing content outside the Hungarian course', () => {
  it('covers the courses, the decks, the conversations and the exams', () => {
    expect(SOURCES.length).toBeGreaterThan(300);
  });

  it('does not mention Hungary or the author', () => {
    const hits: string[] = [];
    for (const file of SOURCES) hitsIn(JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8')), file, hits);
    expect(hits.slice(0, 30)).toEqual([]);
  });
});
