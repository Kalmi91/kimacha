// Besides hablar, the indefinido-imperfecto lesson gets conjugation tables for 5 more common verbs
// (comer, ser, ir, tener, hacer), with an indefinido + imperfecto column, and the table cards
// are asked the same way, with an English prompt, with no vosotros card.

import { lessonFor } from '../syllabus';
import { tableCellsForLesson } from '../tableDeck';

const lesson = lessonFor('es', 'indefinido-imperfecto');
if (!lesson) throw new Error('indefinido-imperfecto must exist');
const cells = tableCellsForLesson(lesson);
const VERBS = ['hablar', 'comer', 'ser', 'ir', 'tener', 'hacer'];

describe('indefinido-imperfecto verb tables (FB468)', () => {
  it('has one indefinido + imperfecto table for each of the six verbs', () => {
    const ids = lesson.body.filter((b) => b.kind === 'table').map((b) => (b as { id: string }).id);
    expect(ids).toEqual(expect.arrayContaining(VERBS.map((v) => `ind-imp-${v}`)));
  });

  it('every table row has a form for both tenses and an English prompt of the same shape', () => {
    for (const b of lesson.body) {
      if (b.kind !== 'table' || !b.id.startsWith('ind-imp-')) continue;
      expect(b.header).toHaveLength(3);
      expect(b.rows).toHaveLength(6);
      b.rows.forEach((row, ri) => {
        expect(row).toHaveLength(3);
        expect(row[1]).toBeTruthy();
        expect(row[2]).toBeTruthy();
        expect(b.enPrompt?.[ri]).toHaveLength(2);
      });
    }
  });

  it('the deck asks 5 persons x 2 tenses for each verb, every card with an English prompt, no vosotros', () => {
    expect(cells).toHaveLength(VERBS.length * 2 * 5);
    expect(cells.every((c) => typeof c.enPrompt === 'string' && c.enPrompt.length > 0)).toBe(true);
    expect(cells.some((c) => /^vosotros/i.test(c.person))).toBe(false);
    for (const v of VERBS) {
      expect(cells.filter((c) => c.verb.startsWith(`${v} (`))).toHaveLength(10);
    }
    expect(cells.find((c) => c.verb === 'hacer (imperfecto)' && c.person === 'yo')?.answer).toBe('hacía');
    expect(cells.find((c) => c.verb === 'tener (perfecto simple)' && c.person === 'él/ella/usted')?.answer).toBe('tuvo');
  });
});
