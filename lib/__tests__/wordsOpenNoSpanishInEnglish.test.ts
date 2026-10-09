// („nem lehet spanyol szó az angol szók között”): a kártyák angol (és magyar / német)
// jelentés-mezőjében nincs spanyol kifejezés. A tipikus szivárgás: „… ; tratar de = to try to”,
// „(sin embargo)”, „(tener razón = …)”: az `=` jel és a spanyol ékezetes betűk az angol mezőben.
import openA1 from '@/data/words-open/a1.json';
import openA2 from '@/data/words-open/a2.json';
import openB1 from '@/data/words-open/b1.json';
import openB2 from '@/data/words-open/b2.json';

type Card = { order: number; level: string; es: string; hu: string; en: string; de: string };
const cards = [...openA1, ...openA2, ...openB1, ...openB2] as unknown as Card[];

describe('words-open: nincs spanyol kifejezés a jelentés-mezőkben (FB453)', () => {
  it('az angol mezőben nincs spanyol ékezetes betű és nincs „=” (kifejezés-magyarázat)', () => {
    const bad = cards.filter((c) => /[ñ¿¡áéíóú]/i.test(c.en) || c.en.includes('='));
    expect(bad.map((c) => `${c.level} ${c.order}: ${c.en}`)).toEqual([]);
  });

  it('a magyar és a német mezőben sincs „=” (spanyol kifejezés-magyarázat)', () => {
    const bad = cards.filter((c) => c.hu.includes('=') || c.de.includes('='));
    expect(bad.map((c) => `${c.level} ${c.order}: ${c.hu} | ${c.de}`)).toEqual([]);
  });

  it('a többszavas spanyol kifejezés (az es mező szavai) nem szerepel zárójelben az angol mezőben', () => {
    const bad = cards.filter((c) => {
      const phrase = c.es.split(' / ').pop()!.trim();
      return phrase.includes(' ') && c.en.toLowerCase().includes(phrase.toLowerCase());
    });
    expect(bad.map((c) => `${c.level} ${c.order}: ${c.en}`)).toEqual([]);
  });
});
