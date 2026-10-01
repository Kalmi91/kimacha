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

  // PLAN-tobbjelentes 3. lépés (S1): a " / " teljes alternatívákat választ el.
  it('splits a " / " separated answer into whole alternatives', () => {
    expect(pcicAlternatives('el carro / el coche / el auto')).toEqual(['el carro', 'el coche', 'el auto']);
  });

  it('keeps the no-space "a/b" behaviour inside a " / " alternative', () => {
    expect(pcicAlternatives('tocar/sentir frío / jugar')).toEqual(['tocar frío', 'sentir frío', 'jugar']);
  });
});

describe('gradePcicAnswer', () => {
  it('a " / " alakból bármelyik alternatíva exact, a best a begépelt alak', () => {
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

// FB400 (PLAN-fb0929 3. lépés): a kérdő- és felkiáltójel sosem hiba.
describe('gradePcicAnswer: írásjelek (FB400)', () => {
  it('a hiányzó ¿ és ? nem hiba', () => {
    expect(gradePcicAnswer('Dónde estás', '¿Dónde estás?').match).toBe('exact');
    expect(gradePcicAnswer('¿Dónde estás', '¿Dónde estás?').match).toBe('exact');
    expect(gradePcicAnswer('Dónde estás?', '¿Dónde estás?').match).toBe('exact');
  });

  it('a hiányzó ¡ és ! nem hiba', () => {
    expect(gradePcicAnswer('Qué bien', '¡Qué bien!').match).toBe('exact');
  });

  it('a mondat közbeni vessző hiánya sem hiba', () => {
    expect(gradePcicAnswer('Hola cómo estás', 'Hola, ¿cómo estás?').match).toBe('exact');
  });

  it('az írásjel nélkül is hibás szó marad hibás', () => {
    expect(gradePcicAnswer('Donde estas', '¿Dónde estás?', true).match).toBe('wrong');
  });

  it('az angol aposztróf a szó része marad', () => {
    expect(gradePcicAnswer("dont", "don't").match).not.toBe('exact');
    expect(gradePcicAnswer("don't", "Don't.").match).toBe('exact');
  });
});

// FB399: a névmás nélküli mondat is jó.
describe('gradeSentenceAnswer: alany-névmás (FB399)', () => {
  it('a névmás nélküli válasz elfogadott, ha a helyes mondat névmással kezdődik', () => {
    expect(gradeSentenceAnswer('como en casa', 'Yo como en casa').match).toBe('exact');
    expect(gradeSentenceAnswer('Como en casa', 'Yo como en casa.').match).toBe('exact');
    expect(gradeSentenceAnswer('vivimos aquí', 'Nosotros vivimos aquí').match).toBe('exact');
  });

  it('a névmással írt válasz továbbra is jó, és a mutatott alak a teljes mondat', () => {
    const g = gradeSentenceAnswer('yo como en casa', 'Yo como en casa');
    expect(g.match).toBe('exact');
    expect(gradeSentenceAnswer('como en casa', 'Yo como en casa').best).toBe('Yo como en casa');
  });

  it('a névelő "El" nem névmás: az "El libro..." nem hagyható el', () => {
    expect(gradeSentenceAnswer('libro es rojo', 'El libro es rojo').match).not.toBe('exact');
    expect(withoutLeadingSubjectPronoun('El libro es rojo')).toBeNull();
    expect(withoutLeadingSubjectPronoun('Él es médico')).toBe('es médico');
  });

  it('a "Tu" birtokos nem névmás, a "Tú" igen', () => {
    expect(withoutLeadingSubjectPronoun('Tu casa es grande')).toBeNull();
    expect(withoutLeadingSubjectPronoun('Tú eres alto')).toBe('eres alto');
  });

  it('a hibás válasz névmás nélkül is hibás', () => {
    expect(gradeSentenceAnswer('bebo en casa', 'Yo como en casa').match).toBe('wrong');
  });
});
