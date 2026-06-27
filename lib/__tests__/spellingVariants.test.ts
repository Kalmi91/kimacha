import { spellingVariants } from '../spellingVariants';

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

describe('spellingVariants', () => {
  const words = ['quiero', 'gato', 'biblioteca', 'el coche', 'amarillo', 'ventana'];

  it('returns the requested count for normal words', () => {
    for (const w of words) {
      expect(spellingVariants(w, 3)).toHaveLength(3);
    }
  });

  it('never returns the correct spelling (accent/case folded)', () => {
    for (const w of words) {
      for (const v of spellingVariants(w, 3)) {
        expect(fold(v)).not.toBe(fold(w));
      }
    }
  });

  it('returns mutually distinct options', () => {
    for (const w of words) {
      const vs = spellingVariants(w, 3).map(fold);
      expect(new Set(vs).size).toBe(vs.length);
    }
  });

  it('is deterministic for a given word', () => {
    expect(spellingVariants('quiero', 3)).toEqual(spellingVariants('quiero', 3));
  });

  it('each variant is a small edit away (length within 1 of the word)', () => {
    for (const w of words) {
      for (const v of spellingVariants(w, 3)) {
        expect(Math.abs(v.length - w.length)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('does not crash on very short words', () => {
    expect(() => spellingVariants('a', 3)).not.toThrow();
    expect(() => spellingVariants('', 3)).not.toThrow();
  });
});
