// PLAN-fb0924 7a. lépés (FB396, D3): a PCIC szint-igazítás döntés-logikája.

import {
  normalizeForLevelFit,
  formsOf,
  bestCorpusLevel,
  targetPcicLevel,
  buildCorpusLevelIndex,
  type CorpusLevel,
} from '../pcicLevelFit';

describe('normalizeForLevelFit', () => {
  it('lowercases', () => {
    expect(normalizeForLevelFit('Habitación')).toBe('habitación');
  });

  it('strips a parenthetical gloss/optional-letter/reflexive marker', () => {
    expect(normalizeForLevelFit('tiene (tener)')).toBe('tiene');
    expect(normalizeForLevelFit('quizá(s)')).toBe('quizá');
    expect(normalizeForLevelFit('(super)mercado')).toBe('mercado');
    expect(normalizeForLevelFit('celebrar(se)')).toBe('celebrar');
    expect(normalizeForLevelFit('(in)visible')).toBe('visible');
  });

  it('strips a leading dictionary article', () => {
    expect(normalizeForLevelFit('el pantalón')).toBe('pantalón');
    expect(normalizeForLevelFit('la casa')).toBe('casa');
    expect(normalizeForLevelFit('los libros')).toBe('libros');
    expect(normalizeForLevelFit('las gafas')).toBe('gafas');
  });

  it('leaves an article-less word untouched (besides lowercasing)', () => {
    expect(normalizeForLevelFit('haber')).toBe('haber');
    expect(normalizeForLevelFit('gente')).toBe('gente');
  });
});

describe('formsOf', () => {
  it('splits "/"-separated alternate forms, each normalized', () => {
    expect(formsOf('el libro / los libros')).toEqual(['libro', 'libros']);
    expect(formsOf('rubio/rubia')).toEqual(['rubio', 'rubia']);
    expect(formsOf('él/ella habla')).toEqual(['él', 'ella habla']);
  });

  it('a plain word has a single form', () => {
    expect(formsOf('morir')).toEqual(['morir']);
  });
});

describe('buildCorpusLevelIndex + bestCorpusLevel', () => {
  const index = buildCorpusLevelIndex({
    a0: [{ es: 'morir' }, { es: 'hacer' }],
    a1: [{ es: 'el color' }, { es: 'la talla' }],
    a2: [{ es: 'el recuerdo' }],
    b1: [{ es: 'el gobierno' }],
  });

  it('finds the level a word was authored at', () => {
    expect(bestCorpusLevel('morir', index)).toBe('a0');
    expect(bestCorpusLevel('color', index)).toBe('a1'); // article stripped both sides
    expect(bestCorpusLevel('el recuerdo', index)).toBe('a2');
  });

  it('returns null for a word not in the corpus', () => {
    expect(bestCorpusLevel('xilófono', index)).toBeNull();
  });

  it('picks the LOWEST level across "/" alternates', () => {
    const idx2 = buildCorpusLevelIndex({
      a0: [{ es: 'bueno' }],
      a1: [],
      a2: [{ es: 'malo' }],
      b1: [],
    });
    expect(bestCorpusLevel('bueno/malo', idx2)).toBe('a0');
  });
});

describe('targetPcicLevel', () => {
  it('moves down to the clamped corpus level when it is lower', () => {
    expect(targetPcicLevel('a2', 'a0')).toBe('a1'); // A0 clamps to the A1 floor
    expect(targetPcicLevel('a2', 'a1')).toBe('a1');
    expect(targetPcicLevel('b1', 'a2')).toBe('a2');
    expect(targetPcicLevel('b2', 'b1')).toBe('b1');
  });

  it('never moves UP, even if the corpus level is higher', () => {
    expect(targetPcicLevel('a1', 'b1')).toBe('a1');
    expect(targetPcicLevel('a1', 'a0')).toBe('a1'); // already at the floor
  });

  it('stays put when the word is not in the corpus', () => {
    expect(targetPcicLevel('b2', null)).toBe('b2');
  });

  it('stays put when the corpus level equals the current PCIC level', () => {
    expect(targetPcicLevel('a2', 'a2')).toBe('a2');
  });

  it('reproduces the flagship feedback examples (FB384/396)', () => {
    // "morir" was PCIC A2 but is an A0 survival word.
    expect(targetPcicLevel('a2', 'a0' as CorpusLevel)).toBe('a1');
    // "muerte" was PCIC B1 but its corpus level is A2.
    expect(targetPcicLevel('b1', 'a2' as CorpusLevel)).toBe('a2');
  });
});
