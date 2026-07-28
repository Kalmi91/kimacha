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

  // FB44: edits must never touch punctuation/whitespace, only letters. A
  // transpose/drop/double landing on "¿"/"?" reads as a broken string, not a
  // plausible misspelling (repro: "¿Dónde estás?" used to yield "está?s").
  it('never moves, drops, or doubles punctuation (¿Dónde estás?)', () => {
    const phrase = '¿Dónde estás?';
    for (const v of spellingVariants(phrase, 3)) {
      expect(v.startsWith('¿')).toBe(true);
      expect(v.endsWith('?')).toBe(true);
      // Exactly one "¿" and one "?", each at the same position as the original,
      // and the space still separates exactly two words.
      expect(v.indexOf('¿')).toBe(phrase.indexOf('¿'));
      expect(v.lastIndexOf('?')).toBe(v.length - 1);
      expect((v.match(/¿/g) ?? []).length).toBe(1);
      expect((v.match(/\?/g) ?? []).length).toBe(1);
      expect(v.split(' ')).toHaveLength(2);
    }
  });

  // FB51: a doubled vowel ("aacera", "quoosco") reads as an obvious fake in
  // the option grid, and consonant doubling is only plausible where Spanish
  // actually doubles (l/r/c/n), no edit may smuggle a doubled vowel in.
  it('never introduces a doubled vowel (la acera, el quiosco)', () => {
    for (const w of ['la acera', 'el quiosco', 'la casa', ...words]) {
      for (const v of spellingVariants(w, 12)) {
        expect(fold(v)).not.toMatch(/([aeiou])\1/);
      }
    }
  });

  // FB61: "el arrroz", a tripled letter occurs in no language, so the option
  // is unmasked at a glance. Both r-doubling and the r/rr confusion could make one.
  it('never triples a letter (el arroz, el perro, la calle)', () => {
    for (const w of ['el arroz', 'el perro', 'la calle', 'la acción', ...words]) {
      for (const v of spellingVariants(w, 12)) {
        expect(fold(v)).not.toMatch(/(\p{L})\1\1/u);
      }
    }
  });

  // FB44: recognition options are [correct, ...spellingVariants(correct, 1)]
  // plus real words; the whole option set must never look identical to the
  // fold-based matcher, or two tiles would be indistinguishable answers.
  it('every variant is fold-distinct from the correct form and from each other', () => {
    for (const w of ['¿Dónde estás?', 'de quién', ...words]) {
      const variants = spellingVariants(w, 3);
      const keys = [fold(w), ...variants.map(fold)];
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});
