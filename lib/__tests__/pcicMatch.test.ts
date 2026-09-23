import { pcicAlternatives, gradePcicAnswer, suggestedGrade } from '../pcicMatch';

describe('pcicAlternatives', () => {
  it('expands a slash alternative into both single-word forms', () => {
    expect(pcicAlternatives('tocar/sentir frío')).toEqual(['tocar frío', 'sentir frío']);
  });

  it('expands a slash alternative when the parts are multi-word', () => {
    expect(pcicAlternatives('asiento/fila de un teatro')).toEqual([
      'asiento de un teatro',
      'fila de un teatro',
    ]);
  });

  it('expands an optional parenthetical part', () => {
    expect(pcicAlternatives('al final (de)')).toEqual(['al final de', 'al final']);
  });
});

describe('gradePcicAnswer', () => {
  it('accepts either side of a slash alternative as exact', () => {
    expect(gradePcicAnswer('tocar frío', 'tocar/sentir frío').match).toBe('exact');
    expect(gradePcicAnswer('sentir frío', 'tocar/sentir frío').match).toBe('exact');
  });

  it('accepts the form without the optional parenthetical part as exact', () => {
    expect(gradePcicAnswer('al final', 'al final (de)').match).toBe('exact');
  });

  it('grades a missing accent as near', () => {
    expect(gradePcicAnswer('cafe', 'café').match).toBe('near');
  });

  it('grades a word-final ending mistake as wrong, not near', () => {
    expect(gradePcicAnswer('buena', 'bueno').match).toBe('wrong');
  });

  it('ignores a missing trailing period', () => {
    expect(gradePcicAnswer('Buenos días', 'Buenos días.').match).toBe('exact');
  });

  it('grades an empty answer as wrong, revealing the correct word (SZ5)', () => {
    const g = gradePcicAnswer('', 'hola');
    expect(g.match).toBe('wrong');
    expect(g.best).toBe('hola');
  });
});

// PLAN-play 10. lépés (s2, anki-ui-terv.html): a Beállítások ékezet-szigor
// kapcsolója a PCIC gépelésén is dönt, és ez adja a Next-gomb javaslatát.
describe('gradePcicAnswer strict accents (PLAN-play 10)', () => {
  it('a missing accent is near + accentOnly when strict is off (default)', () => {
    const g = gradePcicAnswer('cafe', 'café');
    expect(g.match).toBe('near');
    expect(g.accentOnly).toBe(true);
  });

  it('a missing accent is wrong, without accentOnly, when strict is on', () => {
    const g = gradePcicAnswer('cafe', 'café', true);
    expect(g.match).toBe('wrong');
    expect(g.accentOnly).toBeUndefined();
  });

  it('a real letter mistake stays wrong either way', () => {
    expect(gradePcicAnswer('buena', 'bueno', false).match).toBe('wrong');
    expect(gradePcicAnswer('buena', 'bueno', true).match).toBe('wrong');
  });
});

describe('suggestedGrade', () => {
  it('an exact match suggests Knew it', () => {
    expect(suggestedGrade({ match: 'exact', best: 'x' })).toBe('good');
  });

  it('an accent-only near (strict off) suggests Knew it', () => {
    expect(suggestedGrade({ match: 'near', best: 'x', accentOnly: true })).toBe('good');
  });

  it('a non-accent near suggests Didn’t know', () => {
    expect(suggestedGrade({ match: 'near', best: 'x' })).toBe('again');
  });

  it('a wrong match suggests Didn’t know', () => {
    expect(suggestedGrade({ match: 'wrong', best: 'x' })).toBe('again');
  });
});
