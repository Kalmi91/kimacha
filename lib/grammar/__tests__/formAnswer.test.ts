// A gépelt form-feladat ellenőrzője: az `accept` további helyes alakokat enged
// (rövidített alak, szinonim), az `accept` nélküli tételek viselkedése változatlan.

import fs from 'fs';
import path from 'path';
import { formAnswerForCard, formAnswers, isFormAnswerCorrect } from '../formAnswer';
import type { LessonV2 } from '../lessonTypes';

const grammarDir = (lang: string) => path.join(__dirname, '..', '..', '..', 'data', 'games', 'grammar', lang);
const lessonsOf = (lang: string): [string, LessonV2][] =>
  fs
    .readdirSync(grammarDir(lang))
    .filter((f) => f.endsWith('.json'))
    .map((f) => [f, JSON.parse(fs.readFileSync(path.join(grammarDir(lang), f), 'utf8')) as LessonV2] as [string, LessonV2]);

describe('isFormAnswerCorrect', () => {
  it('accept nélkül: trim + kisbetű egyezés, mint eddig', () => {
    const item = { answer: 'Seen' };
    expect(isFormAnswerCorrect('seen', item)).toBe(true);
    expect(isFormAnswerCorrect('  SEEN ', item)).toBe(true);
    expect(isFormAnswerCorrect('saw', item)).toBe(false);
    expect(isFormAnswerCorrect('', item)).toBe(false);
  });

  it('az accept alakjai is helyesek, a fő alak is', () => {
    const item = { answer: 'must not', accept: ["mustn't"] };
    expect(isFormAnswerCorrect('must not', item)).toBe(true);
    expect(isFormAnswerCorrect("Mustn't", item)).toBe(true);
    expect(isFormAnswerCorrect('mustnt', item)).toBe(false);
    expect(formAnswers(item)).toEqual(['must not', "mustn't"]);
  });

  it('a telefon okos aposztrófját (’) elfogadja az egyenes helyett', () => {
    const item = { answer: 'must not', accept: ["mustn't"] };
    expect(isFormAnswerCorrect('mustn’t', item)).toBe(true);
  });
});

describe('formAnswerForCard', () => {
  it('accept nélkül a fő alak, accept mellett perjeles vagylagos lista', () => {
    expect(formAnswerForCard({ answer: 'seen' })).toBe('seen');
    expect(formAnswerForCard({ answer: 'should', accept: ['ought to'] })).toBe('should / ought to');
  });
});

describe('a leckék form-tételei', () => {
  it('a spanyol leckék form-válaszaiban nincs okos aposztróf, és egyetlen form-tételnek van accept-je (ct-form-09, a lecke maga írta elő)', () => {
    const withAccept: string[] = [];
    for (const [, lesson] of lessonsOf('es')) {
      for (const item of lesson.items) {
        if (item.kind !== 'form') continue;
        expect(item.answer).not.toMatch(/[’‘]/);
        if (item.accept) withAccept.push(item.id);
      }
    }
    expect(withAccept).toEqual(['ct-form-09']);
  });

  it('az angol leckék accept-listái nem üresek, egyediek és nem ismétlik a fő alakot; a fő alak benne van a hivatkozott táblában', () => {
    for (const [file, lesson] of lessonsOf('en')) {
      for (const item of lesson.items) {
        if (item.kind !== 'form') continue;
        if (item.accept !== undefined) {
          expect({ file, id: item.id, n: item.accept.length > 0 }).toEqual({ file, id: item.id, n: true });
          const keys = [item.answer, ...item.accept].map((a) => a.trim().toLowerCase());
          expect({ file, id: item.id, unique: new Set(keys).size }).toEqual({ file, id: item.id, unique: keys.length });
        }
      }
    }
  });
});
