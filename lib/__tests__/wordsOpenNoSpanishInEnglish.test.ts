// User feedback ("there must be no Spanish word among the English words"): the English (and Hungarian / German)
// meaning fields of the cards contain no Spanish expression. The typical leak: "… ; tratar de = to try to",
// "(sin embargo)", "(tener razón = …)": the `=` sign and Spanish accented letters in the English field.
import openA1 from '@/data/words-open/a1.json';
import openA2 from '@/data/words-open/a2.json';
import openB1 from '@/data/words-open/b1.json';
import openB2 from '@/data/words-open/b2.json';

type Card = { order: number; level: string; es: string; hu: string; en: string; de: string };
const cards = [...openA1, ...openA2, ...openB1, ...openB2] as unknown as Card[];

describe('words-open: no Spanish expression in the meaning fields', () => {
  it('the English field has no Spanish accented letter and no "=" (expression explanation)', () => {
    const bad = cards.filter((c) => /[ñ¿¡áéíóú]/i.test(c.en) || c.en.includes('='));
    expect(bad.map((c) => `${c.level} ${c.order}: ${c.en}`)).toEqual([]);
  });

  it('the Hungarian and German fields have no "=" either (Spanish expression explanation)', () => {
    const bad = cards.filter((c) => c.hu.includes('=') || c.de.includes('='));
    expect(bad.map((c) => `${c.level} ${c.order}: ${c.hu} | ${c.de}`)).toEqual([]);
  });

  it('a multi-word Spanish expression (the words of the es field) does not appear in parentheses in the English field', () => {
    const bad = cards.filter((c) => {
      const phrase = c.es.split(' / ').pop()!.trim();
      return phrase.includes(' ') && c.en.toLowerCase().includes(phrase.toLowerCase());
    });
    expect(bad.map((c) => `${c.level} ${c.order}: ${c.en}`)).toEqual([]);
  });
});
