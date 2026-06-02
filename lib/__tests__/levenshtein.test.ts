import { levenshtein } from '../levenshtein';

describe('levenshtein', () => {
  it('is 0 for identical strings', () => {
    expect(levenshtein('hola', 'hola')).toBe(0);
  });

  it('equals the other length when one string is empty', () => {
    expect(levenshtein('', 'casa')).toBe(4);
    expect(levenshtein('casa', '')).toBe(4);
    expect(levenshtein('', '')).toBe(0);
  });

  it('counts a single substitution', () => {
    expect(levenshtein('casa', 'caso')).toBe(1);
  });

  it('counts a single insertion or deletion', () => {
    expect(levenshtein('cas', 'casa')).toBe(1);
    expect(levenshtein('casa', 'cas')).toBe(1);
  });

  it('matches the classic kitten → sitting distance', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
  });

  it('is symmetric', () => {
    expect(levenshtein('perro', 'pero')).toBe(levenshtein('pero', 'perro'));
  });
});
