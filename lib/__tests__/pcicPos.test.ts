import { posOf } from '../pcicPos';

describe('posOf (5c, FB348/351/358/359)', () => {
  // 'el perro'/'la mesa'/'una casa' are all in the main
  // corpus (data/words-open) with pos+gender, so they are now returned
  // by the corpus, gender included, not by the article rule.
  it('a korpuszban meglévő lemma nemmel együtt jön, ha főnév', () => {
    expect(posOf({ es: 'el perro', kind: 'word' })).toEqual({ pos: 'noun', gender: 'm' });
    expect(posOf({ es: 'la mesa', kind: 'word' })).toEqual({ pos: 'noun', gender: 'f' });
    expect(posOf({ es: 'una casa', kind: 'word' })).toEqual({ pos: 'noun', gender: 'f' });
  });

  // the PCIC 'city' card ('es: "ciudad"', without an article) lives in the corpus
  // as 'la ciudad', noun/f; this was the case of the missing chip.
  it('névelő nélkül tárolt PCIC-alak is megtalálja a korpusz lemmáját', () => {
    expect(posOf({ es: 'ciudad', kind: 'word' })).toEqual({ pos: 'noun', gender: 'f' });
  });

  it('los/las/un/una kezdetű, korpuszban nem szereplő alakot is főnévnek jelöli (névelő-szabály)', () => {
    // 'los libros' is plural, the corpus has only 'el libro' (singular),
    // so this falls back to the old article rule, without gender.
    expect(posOf({ es: 'los libros', kind: 'word' })).toEqual({ pos: 'noun' });
  });

  it('egyszavas -ar/-er/-ir végű, korpuszban lévő alakot igének jelöl', () => {
    expect(posOf({ es: 'mejorar', kind: 'word' })).toEqual({ pos: 'verb' });
    expect(posOf({ es: 'comer', kind: 'word' })).toEqual({ pos: 'verb' });
  });

  it('visszaható -arse/-erse/-irse végű alakot is igének jelöl', () => {
    expect(posOf({ es: 'levantarse', kind: 'word' })).toEqual({ pos: 'verb' });
  });

  it('kind=phrase vagy névelő nélküli többszavas alakot kifejezésnek jelöl', () => {
    expect(posOf({ es: 'de vez en cuando', kind: 'phrase' })).toEqual({ pos: 'phrase' });
    expect(posOf({ es: 'tocar frío', kind: 'word' })).toEqual({ pos: 'phrase' });
  });

  // Pos is now the full WordPos set, so the corpus's 'adj'
  // ('bueno') no longer drops out of the lemma index; it gets a chip.
  it('a korpuszban adj/adv/pron/prep/num szófajú lemma is chipet kap', () => {
    expect(posOf({ es: 'bueno', kind: 'word' })).toEqual({ pos: 'adj' });
  });

  it('a meglévő pos mezőt előnyben részesíti a korpusszal és a szabállyal szemben', () => {
    expect(posOf({ es: 'bueno', kind: 'word', pos: 'verb' })).toEqual({ pos: 'verb' });
  });

  // 'deber' appeared in the old corpus once as a verb and once as a noun (m),
  // with different parts of speech; we do not guess on a colliding lemma. words-open
  // has no colliding lemma, so the same two cards are supplied by a fixture.
  it('ütköző korpusz-találatnál (eltérő szófaj) nincs chip', () => {
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

  it('a korpuszban nem szereplő lemma a régi szabályra esik vissza', () => {
    expect(posOf({ es: 'xyzabc', kind: 'word' })).toBe(null);
    expect(posOf({ es: 'el xyzabc', kind: 'word' })).toEqual({ pos: 'noun' });
  });

  // "sentences need no part of speech", even if there were a pos field or
  // a corpus match.
  it('sentence kindre sose ad chipet', () => {
    expect(posOf({ es: 'el perro', kind: 'sentence' })).toBe(null);
  });
});
