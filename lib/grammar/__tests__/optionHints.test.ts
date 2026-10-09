// Every rule option of the ser/estar "why" exercise
// has a lowercase example line under it, in both languages.
import esSerEstar from '@/data/games/grammar/es/ser-estar.json';
import enToBe from '@/data/games/grammar/en/to-be.json';
import { OPTION_HINTS, optionHint } from '../optionHints';
import type { LessonV2 } from '../lessonTypes';

const whyOptions = (lesson: LessonV2) =>
  lesson.items.flatMap((it) => (it.kind === 'why' ? it.options.map((o) => o.text) : []));

describe('optionHint', () => {
  it('every "why" option of the ser-estar lesson has an example row in both languages', () => {
    for (const text of whyOptions(esSerEstar as unknown as LessonV2)) {
      for (const lang of ['en', 'es']) {
        const hint = optionHint(text, lang);
        expect(hint).toBeTruthy();
        expect(hint).toContain('·');
      }
    }
  });

  it('every "why" option of the to-be lesson has one too', () => {
    for (const text of whyOptions(enToBe as unknown as LessonV2)) {
      expect(optionHint(text, 'es')).toBeTruthy();
      expect(optionHint(text, 'en')).toBeTruthy();
    }
  });

  it('the character trait ("es amable") appears under the identity rule', () => {
    expect(OPTION_HINTS['profession, identity (ser)'].en).toContain('es amable');
    expect(OPTION_HINTS['profession, identity (ser)'].en).toContain('Soy Ana, es médico');
  });

  it('gives no example row for an unknown option', () => {
    expect(optionHint({ en: 'no such rule', es: 'x' }, 'en')).toBeUndefined();
  });

  it('the hint starts with a lowercase letter (faint, small row, not a title)', () => {
    for (const hint of Object.values(OPTION_HINTS)) {
      expect(hint.en[0]).toBe(hint.en[0].toLowerCase());
      expect(hint.es[0]).toBe(hint.es[0].toLowerCase());
    }
  });
});
