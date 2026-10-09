import { posOf } from '../pcicPos';

describe('posOf', () => {
  // 'el perro'/'la mesa'/'una casa' are all in the main
  // corpus (data/words-open) with pos+gender, so they are now returned
  // by the corpus, gender included, not by the article rule.
  it('a lemma present in the corpus comes with its gender if it is a noun', () => {
    expect(posOf({ es: 'el perro', kind: 'word' })).toEqual({ pos: 'noun', gender: 'm' });
    expect(posOf({ es: 'la mesa', kind: 'word' })).toEqual({ pos: 'noun', gender: 'f' });
    expect(posOf({ es: 'una casa', kind: 'word' })).toEqual({ pos: 'noun', gender: 'f' });
  });

  // the PCIC 'city' card ('es: "ciudad"', without an article) lives in the corpus
  // as 'la ciudad', noun/f; this was the case of the missing chip.
  it('a PCIC form stored without an article also finds the corpus lemma', () => {
    expect(posOf({ es: 'ciudad', kind: 'word' })).toEqual({ pos: 'noun', gender: 'f' });
  });

  it('a form starting with los/las/un/una and absent from the corpus is also marked a noun (article rule)', () => {
    // 'los libros' is plural, the corpus has only 'el libro' (singular),
    // so this falls back to the old article rule, without gender.
    expect(posOf({ es: 'los libros', kind: 'word' })).toEqual({ pos: 'noun' });
  });

  it('a single-word form ending in -ar/-er/-ir and present in the corpus is marked a verb', () => {
    expect(posOf({ es: 'mejorar', kind: 'word' })).toEqual({ pos: 'verb' });
    expect(posOf({ es: 'comer', kind: 'word' })).toEqual({ pos: 'verb' });
  });

  it('a reflexive form ending in -arse/-erse/-irse is also marked a verb', () => {
    expect(posOf({ es: 'levantarse', kind: 'word' })).toEqual({ pos: 'verb' });
  });

  it('kind=phrase or a multi-word form without an article is marked a phrase', () => {
    expect(posOf({ es: 'de vez en cuando', kind: 'phrase' })).toEqual({ pos: 'phrase' });
    expect(posOf({ es: 'tocar frío', kind: 'word' })).toEqual({ pos: 'phrase' });
  });

  // Pos is now the full WordPos set, so the corpus's 'adj'
  // ('bueno') no longer drops out of the lemma index; it gets a chip.
  it('a lemma with adj/adv/pron/prep/num part of speech in the corpus gets a chip too', () => {
    expect(posOf({ es: 'bueno', kind: 'word' })).toEqual({ pos: 'adj' });
  });

  it('it prefers the existing pos field over the corpus and the rule', () => {
    expect(posOf({ es: 'bueno', kind: 'word', pos: 'verb' })).toEqual({ pos: 'verb' });
  });

  // 'deber' appeared in the old corpus once as a verb and once as a noun (m),
  // with different parts of speech; we do not guess on a colliding lemma. words-open
  // has no colliding lemma, so the same two cards are supplied by a fixture.
  it('on a conflicting corpus match (different part of speech) there is no chip', () => {
    jest.isolateModules(() => {
      jest.doMock('@/data/openWords', () => ({
        openWords: [
          { es: 'deber', openPos: 'verb' },
          { es: 'el deber', openPos: 'noun', gender: 'm' },
        ],
      }));
      const isolated = require('../pcicPos') as typeof import('../pcicPos');
      expect(isolated.posOf({ es: 'deber', kind: 'word' })).toBe(null);
    });
    jest.dontMock('@/data/openWords');
  });

  it('a lemma absent from the corpus falls back to the old rule', () => {
    expect(posOf({ es: 'xyzabc', kind: 'word' })).toBe(null);
    expect(posOf({ es: 'el xyzabc', kind: 'word' })).toEqual({ pos: 'noun' });
  });

  // "sentences need no part of speech", even if there were a pos field or
  // a corpus match.
  it('never gives a chip for the sentence kind', () => {
    expect(posOf({ es: 'el perro', kind: 'sentence' })).toBe(null);
  });
});
