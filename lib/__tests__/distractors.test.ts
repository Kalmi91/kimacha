import { nearMissDistractors } from '../distractors';

describe('nearMissDistractors', () => {
  it('returns the requested count of distractors', () => {
    const out = nearMissDistractors(['el', 'autobús', 'llega'], ['comer', 'casa', 'rojo'], 'es');
    expect(out).toHaveLength(3);
  });

  it('never includes a word from the answer sentence', () => {
    const target = ['yo', 'hablo', 'español'];
    const out = nearMissDistractors(target, ['hablo', 'comer', 'vivir', 'casa'], 'es');
    target.forEach((w) => expect(out.map((o) => o.toLowerCase())).not.toContain(w));
  });

  it('offers sibling articles when the sentence uses an article', () => {
    const out = nearMissDistractors(['el', 'gato'], ['comer', 'rojo', 'casa'], 'es');
    // at least one of the other Spanish articles should appear
    expect(out.some((w) => ['la', 'los', 'las', 'un', 'una'].includes(w))).toBe(true);
  });

  it('prefers same-stem verb forms over random vocab', () => {
    const out = nearMissDistractors(['el', 'autobús', 'llega'], ['llegan', 'llegas', 'comer', 'rojo'], 'es');
    expect(out.some((w) => ['llegan', 'llegas'].includes(w))).toBe(true);
  });

  it('caps article distractors at two so a slot stays for other forms', () => {
    const out = nearMissDistractors(['el', 'libro'], ['libros', 'comer', 'rojo'], 'es');
    const articleCount = out.filter((w) => ['la', 'los', 'las', 'un', 'una', 'unos', 'unas'].includes(w)).length;
    expect(articleCount).toBeLessThanOrEqual(2);
  });

  it('does not produce duplicates', () => {
    const out = nearMissDistractors(['hola'], ['casa', 'casa', 'rojo', 'verde'], 'es');
    expect(new Set(out.map((w) => w.toLowerCase())).size).toBe(out.length);
  });
});
