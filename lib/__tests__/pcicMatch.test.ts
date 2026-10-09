import { pcicAlternatives, gradePcicAnswer, gradeSentenceAnswer, suggestedGrade, withoutLeadingSubjectPronoun } from '../pcicMatch';

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

  // a " / " separates complete alternatives.
  it('splits a " / " separated answer into whole alternatives', () => {
    expect(pcicAlternatives('el carro / el coche / el auto')).toEqual(['el carro', 'el coche', 'el auto']);
  });

  it('keeps the no-space "a/b" behaviour inside a " / " alternative', () => {
    expect(pcicAlternatives('tocar/sentir frío / jugar')).toEqual(['tocar frío', 'sentir frío', 'jugar']);
  });
});

describe('gradePcicAnswer', () => {
  it('any alternative of a " / " form is exact, best is the typed form', () => {
    const target = 'el carro / el coche / el auto';
    expect(gradePcicAnswer('el coche', target)).toEqual({ match: 'exact', best: 'el coche' });
    expect(gradePcicAnswer('el carro', target)).toEqual({ match: 'exact', best: 'el carro' });
    expect(gradePcicAnswer('el auto', target)).toEqual({ match: 'exact', best: 'el auto' });
    expect(gradePcicAnswer('el tren', target).match).toBe('wrong');
  });

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

// The accent-strictness switch in Settings
// also decides on PCIC typing, and it drives the suggestion of the Next button.
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

// question and exclamation marks are never a mistake.
describe('gradePcicAnswer: punctuation', () => {
  it('a missing ¿ and ? is not an error', () => {
    expect(gradePcicAnswer('Dónde estás', '¿Dónde estás?').match).toBe('exact');
    expect(gradePcicAnswer('¿Dónde estás', '¿Dónde estás?').match).toBe('exact');
    expect(gradePcicAnswer('Dónde estás?', '¿Dónde estás?').match).toBe('exact');
  });

  it('a missing ¡ and ! is not an error', () => {
    expect(gradePcicAnswer('Qué bien', '¡Qué bien!').match).toBe('exact');
  });

  it('a missing comma inside the sentence is not an error either', () => {
    expect(gradePcicAnswer('Hola cómo estás', 'Hola, ¿cómo estás?').match).toBe('exact');
  });

  it('a word wrong even without punctuation stays wrong', () => {
    expect(gradePcicAnswer('Donde estas', '¿Dónde estás?', true).match).toBe('wrong');
  });

  it('the English apostrophe stays part of the word', () => {
    expect(gradePcicAnswer("dont", "don't").match).not.toBe('exact');
    expect(gradePcicAnswer("don't", "Don't.").match).toBe('exact');
  });
});

// a sentence without the pronoun is correct too.
describe('gradeSentenceAnswer: subject pronoun', () => {
  it('an answer without the pronoun is accepted if the correct sentence starts with a pronoun', () => {
    expect(gradeSentenceAnswer('como en casa', 'Yo como en casa').match).toBe('exact');
    expect(gradeSentenceAnswer('Como en casa', 'Yo como en casa.').match).toBe('exact');
    expect(gradeSentenceAnswer('vivimos aquí', 'Nosotros vivimos aquí').match).toBe('exact');
  });

  it('an answer written with the pronoun is still right, and the shown form is the full sentence', () => {
    const g = gradeSentenceAnswer('yo como en casa', 'Yo como en casa');
    expect(g.match).toBe('exact');
    expect(gradeSentenceAnswer('como en casa', 'Yo como en casa').best).toBe('Yo como en casa');
  });

  it('the article "El" is not a pronoun: "El libro..." cannot be dropped', () => {
    expect(gradeSentenceAnswer('libro es rojo', 'El libro es rojo').match).not.toBe('exact');
    expect(withoutLeadingSubjectPronoun('El libro es rojo')).toBeNull();
    expect(withoutLeadingSubjectPronoun('Él es médico')).toBe('es médico');
  });

  it('the possessive "Tu" is not a pronoun, "Tú" is', () => {
    expect(withoutLeadingSubjectPronoun('Tu casa es grande')).toBeNull();
    expect(withoutLeadingSubjectPronoun('Tú eres alto')).toBe('eres alto');
  });

  it('a wrong answer is wrong even without the pronoun', () => {
    expect(gradeSentenceAnswer('bebo en casa', 'Yo como en casa').match).toBe('wrong');
  });
});
