import { posOf } from '../pcicPos';

describe('posOf (5c, FB348/351/358/359)', () => {
  it('el/la kezdetű alakot főnévnek jelöl', () => {
    expect(posOf({ es: 'el perro', kind: 'word' })).toBe('noun');
    expect(posOf({ es: 'la mesa', kind: 'word' })).toBe('noun');
  });

  it('los/las/un/una kezdetű alakot is főnévnek jelöl', () => {
    expect(posOf({ es: 'los libros', kind: 'word' })).toBe('noun');
    expect(posOf({ es: 'una casa', kind: 'word' })).toBe('noun');
  });

  it('egyszavas -ar/-er/-ir végű alakot igének jelöl', () => {
    expect(posOf({ es: 'mejorar', kind: 'word' })).toBe('verb');
    expect(posOf({ es: 'comer', kind: 'word' })).toBe('verb');
  });

  it('visszaható -arse/-erse/-irse végű alakot is igének jelöl', () => {
    expect(posOf({ es: 'levantarse', kind: 'word' })).toBe('verb');
  });

  it('kind=phrase vagy névelő nélküli többszavas alakot kifejezésnek jelöl', () => {
    expect(posOf({ es: 'de vez en cuando', kind: 'phrase' })).toBe('phrase');
    expect(posOf({ es: 'tocar frío', kind: 'word' })).toBe('phrase');
  });

  it('egyéb egyszavas, nem igevégű, névelő nélküli alaknál nincs chip', () => {
    expect(posOf({ es: 'bueno', kind: 'word' })).toBe(null);
  });

  it('a meglévő pos mezőt előnyben részesíti a szabállyal szemben', () => {
    expect(posOf({ es: 'bueno', kind: 'word', pos: 'verb' })).toBe('verb');
  });
});
