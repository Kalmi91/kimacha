// Every rule option of the ser/estar "why" exercise
// has a lowercase example line under it, in four languages.
import esSerEstar from '@/data/games/grammar/es/ser-estar.json';
import enToBe from '@/data/games/grammar/en/to-be.json';
import { OPTION_HINTS, optionHint } from '../optionHints';
import type { LessonV2 } from '../lessonTypes';

const whyOptions = (lesson: LessonV2) =>
  lesson.items.flatMap((it) => (it.kind === 'why' ? it.options.map((o) => o.text) : []));

describe('optionHint', () => {
  it('a ser-estar lecke minden "miért" opciójához van példa-sor mind a négy nyelven', () => {
    for (const text of whyOptions(esSerEstar as unknown as LessonV2)) {
      for (const lang of ['hu', 'en', 'es', 'de']) {
        const hint = optionHint(text, lang);
        expect(hint).toBeTruthy();
        expect(hint).toContain('·');
      }
    }
  });

  it('a to-be lecke minden "miért" opciójához is van', () => {
    for (const text of whyOptions(enToBe as unknown as LessonV2)) {
      expect(optionHint(text, 'es')).toBeTruthy();
      expect(optionHint(text, 'en')).toBeTruthy();
    }
  });

  it('a jellem ("es amable") az identitás-szabály alatt szerepel (FB410)', () => {
    expect(OPTION_HINTS['profession, identity (ser)'].en).toContain('es amable');
    expect(OPTION_HINTS['profession, identity (ser)'].en).toContain('Soy Ana, es médico');
  });

  it('ismeretlen opcióhoz nem ad példa-sort', () => {
    expect(optionHint({ hu: 'x', en: 'no such rule', es: 'x', de: 'x' }, 'en')).toBeUndefined();
  });

  it('a hint kisbetűvel kezdődik (halvány, kis sor, nem cím)', () => {
    for (const hint of Object.values(OPTION_HINTS)) {
      expect(hint.en[0]).toBe(hint.en[0].toLowerCase());
      expect(hint.es[0]).toBe(hint.es[0].toLowerCase());
    }
  });
});
