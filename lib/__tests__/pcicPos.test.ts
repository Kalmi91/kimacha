import { posOf } from '../pcicPos';

describe('posOf (5c, FB348/351/358/359)', () => {
  // FB350 (3. commit): 'el perro'/'la mesa'/'una casa' mind megvan a fő
  // korpuszban (data/words-open) pos+gender-rel, ezért ezeket most a korpusz adja
  // vissza, nemmel együtt, nem a névelő-szabály.
  it('a korpuszban meglévő lemma nemmel együtt jön, ha főnév', () => {
    expect(posOf({ es: 'el perro', kind: 'word' })).toEqual({ pos: 'noun', gender: 'm' });
    expect(posOf({ es: 'la mesa', kind: 'word' })).toEqual({ pos: 'noun', gender: 'f' });
    expect(posOf({ es: 'una casa', kind: 'word' })).toEqual({ pos: 'noun', gender: 'f' });
  });

  // FB350: a PCIC 'city' kártyája ('es: "ciudad"', névelő nélkül) a korpuszban
  // 'la ciudad' alakban él, noun/f-fel; ez volt a hiányzó chip esete.
  it('névelő nélkül tárolt PCIC-alak is megtalálja a korpusz lemmáját', () => {
    expect(posOf({ es: 'ciudad', kind: 'word' })).toEqual({ pos: 'noun', gender: 'f' });
  });

  it('los/las/un/una kezdetű, korpuszban nem szereplő alakot is főnévnek jelöli (névelő-szabály)', () => {
    // 'los libros' többes szám, a korpuszban csak 'el libro' (egyes szám) van,
    // tehát ez a régi névelő-szabályra esik, gender nélkül.
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

  // FB361-362: a Pos immár a teljes WordPos-készlet, ezért a korpusz 'adj'-ja
  // ('bueno') már nem esik ki a lemma-indexből, van chip.
  it('a korpuszban adj/adv/pron/prep/num szófajú lemma is chipet kap', () => {
    expect(posOf({ es: 'bueno', kind: 'word' })).toEqual({ pos: 'adj' });
  });

  it('a meglévő pos mezőt előnyben részesíti a korpusszal és a szabállyal szemben', () => {
    expect(posOf({ es: 'bueno', kind: 'word', pos: 'verb' })).toEqual({ pos: 'verb' });
  });

  // FB350: 'deber' a régi korpuszban egyszer igeként, egyszer főnévként (m) is
  // szerepelt, eltérő szófajjal; ütköző lemmánál nem találgatunk. A words-openben
  // nincs ütköző lemma, ezért ugyanezt a két kártyát fixture adja.
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

  // FB362: "a mondatoknál nem kell szofaj", akkor sem, ha volna pos mező vagy
  // korpusz-egyezés.
  it('sentence kindre sose ad chipet', () => {
    expect(posOf({ es: 'el perro', kind: 'sentence' })).toBe(null);
  });
});
