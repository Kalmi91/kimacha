import { pcicAlternatives, gradePcicAnswer } from '../pcicMatch';

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
