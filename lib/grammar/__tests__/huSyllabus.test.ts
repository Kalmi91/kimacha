// The Hungarian syllabus titles (data/games/grammar-hu/syllabus.json) cover every unit and topic of both
// courses, and lib/grammar/syllabus.ts / syllabusEn.ts lay them over as `hu` of title / blurb.
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import huSyllabus from '@/data/games/grammar-hu/syllabus.json';
import { getGrammarSyllabus, getGrammarUnits, syllabusTopic, topicsForUnit, unitsForLevel } from '../syllabus';
import { EN_SYLLABUS, EN_UNITS } from '../syllabusEn';
import { withHuTitles } from '../huOverlay';

describe('Hungarian syllabus titles', () => {
  it('es course: every unit has a hu title, every topic a hu title and blurb, and the file has no stray ids', () => {
    const units = getGrammarUnits();
    const topics = getGrammarSyllabus();
    for (const u of units) expect(u.title.hu?.trim()).toBeTruthy();
    for (const t of topics) {
      expect(t.title.hu?.trim()).toBeTruthy();
      expect(t.blurb.hu?.trim()).toBeTruthy();
    }
    expect(Object.keys(huSyllabus.es.units).sort()).toEqual(units.map((u) => u.id).sort());
    expect(Object.keys(huSyllabus.es.topics).sort()).toEqual(topics.map((t) => t.id).sort());
  });

  it('en course: every unit and topic has a hu title, and the file has no stray ids', () => {
    for (const u of EN_UNITS) expect(u.title.hu?.trim()).toBeTruthy();
    for (const t of EN_SYLLABUS) expect(t.title.hu?.trim()).toBeTruthy();
    expect(Object.keys(huSyllabus.en.units).sort()).toEqual(EN_UNITS.map((u) => u.id).sort());
    expect(Object.keys(huSyllabus.en.topics).sort()).toEqual(EN_SYLLABUS.map((t) => t.id).sort());
  });

  it('a topic whose list title and lesson title agree in English agrees in Hungarian too (list row = lesson header)', () => {
    const root = join(__dirname, '../../..');
    const read = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8'));
    for (const [course, topics] of [['es', getGrammarSyllabus()], ['en', EN_SYLLABUS]] as const) {
      for (const t of topics) {
        const file = [t.id, t.id.replace(/_/g, '-')].find((f) => existsSync(join(root, `data/games/grammar/${course}/${f}.json`)));
        if (!file) continue;
        const en = read(`data/games/grammar/${course}/${file}.json`).title?.en;
        if (en !== t.title.en) continue;
        expect([course, t.id, t.title.hu]).toEqual([course, t.id, read(`data/games/grammar-hu/${course}/${file}.json`)[en]]);
      }
    }
  });

  it('is reachable through the syllabus API and leaves the en / es texts as they were', () => {
    const serEstar = syllabusTopic('ser-estar', 'es')!;
    expect(serEstar.title.hu).toBe('Ser vagy estar?');
    expect(serEstar.title.en).toBe('Ser or estar?');
    expect(syllabusTopic('to_be', 'en')!.title.hu).toBeTruthy();
    expect(unitsForLevel('A1', 'en')[0].title.hu).toBe('Első lépések');
    for (const t of topicsForUnit('a1-presente', 'es')) expect(t.title.hu).toBeTruthy();
  });

  it('withHuTitles leaves an id without an entry alone and only adds a blurb where the entry has one', () => {
    const entries: { id: string; title: Record<string, string>; blurb?: Record<string, string> }[] = [
      { id: 'a', title: { en: 'A', es: 'A' }, blurb: { en: 'a', es: 'a' } },
      { id: 'b', title: { en: 'B', es: 'B' }, blurb: {} },
      { id: 'c', title: { en: 'C', es: 'C' } },
    ];
    const out = withHuTitles(entries, { a: { title: 'Á', blurb: 'á' }, b: 'Bé' });
    expect(out[0]).toEqual({ id: 'a', title: { en: 'A', es: 'A', hu: 'Á' }, blurb: { en: 'a', es: 'a', hu: 'á' } });
    expect(out[1]).toEqual({ id: 'b', title: { en: 'B', es: 'B', hu: 'Bé' }, blurb: {} });
    expect(out[2]).toBe(entries[2]);
    expect(entries[0].title).toEqual({ en: 'A', es: 'A' });
  });
});
