// The checks of the four typed task kinds added for the grammar tests (open cloze, error correction by typing,
// word bank, typed noun form). Pure functions: the typing rules are the transform / write rules (case and
// punctuation do not count, the accent switch decides on the accents).

import {
  clozeGapCount,
  clozeParts,
  filledCloze,
  filledSentence,
  gradeCloze,
  isBankAnswerRight,
  isFixAnswerRight,
  isNounAnswerRight,
} from '../typedKinds';

const CLOZE = { text: 'Me llamo Ana. ___ de México y ___ 25 años. Mi casa ___ cerca del centro.', answers: ['soy', 'tengo', 'está'], accept: [['yo soy'], [], []] };

describe('open cloze', () => {
  it('splits the text at the gaps', () => {
    expect(clozeGapCount(CLOZE.text)).toBe(3);
    expect(clozeParts(CLOZE.text)).toHaveLength(4);
    expect(clozeParts(CLOZE.text)[0]).toBe('Me llamo Ana. ');
    expect(clozeGapCount('no gap here')).toBe(0);
  });

  it('grades every gap on its own', () => {
    expect(gradeCloze(CLOZE, ['soy', 'tengo', 'está'], true)).toEqual([true, true, true]);
    expect(gradeCloze(CLOZE, ['soy', 'tienes', 'está'], true)).toEqual([true, false, true]);
    expect(gradeCloze(CLOZE, ['', '', ''], false)).toEqual([false, false, false]);
  });

  it('is lenient with case and punctuation, and uses `accept` per gap', () => {
    expect(gradeCloze(CLOZE, ['SOY.', ' Tengo ', 'ESTÁ'], true)).toEqual([true, true, true]);
    expect(gradeCloze(CLOZE, ['yo soy', 'tengo', 'está'], true)[0]).toBe(true);
  });

  it('accents: forgiven on the lenient setting, a mistake on the strict one', () => {
    expect(gradeCloze(CLOZE, ['soy', 'tengo', 'esta'], false)[2]).toBe(true);
    expect(gradeCloze(CLOZE, ['soy', 'tengo', 'esta'], true)[2]).toBe(false);
  });

  it('a missing typed entry counts as wrong, not as a crash', () => {
    expect(gradeCloze(CLOZE, ['soy'], false)).toEqual([true, false, false]);
  });

  it('writes the answers into the gaps', () => {
    expect(filledCloze(CLOZE.text, CLOZE.answers)).toBe('Me llamo Ana. soy de México y tengo 25 años. Mi casa está cerca del centro.');
  });
});

describe('error correction (fix)', () => {
  const item = { answer: 'está', accept: ['queda'] };
  it('the typed fix must match', () => {
    expect(isFixAnswerRight('está', item, true)).toBe(true);
    expect(isFixAnswerRight('Está.', item, true)).toBe(true);
    expect(isFixAnswerRight('queda', item, true)).toBe(true);
    expect(isFixAnswerRight('es', item, true)).toBe(false);
    expect(isFixAnswerRight('', item, false)).toBe(false);
  });
  it('accents follow the setting', () => {
    expect(isFixAnswerRight('esta', item, false)).toBe(true);
    expect(isFixAnswerRight('esta', item, true)).toBe(false);
  });
});

describe('word bank', () => {
  const item = { answer: 'altas', accept: undefined, es: 'Las chicas son ___ .' };
  it('the agreed form is right, the bank form is not', () => {
    expect(isBankAnswerRight('altas', item, true)).toBe(true);
    expect(isBankAnswerRight('alto', item, true)).toBe(false);
    expect(isBankAnswerRight('alta', item, true)).toBe(false);
  });
  it('fills the sentence', () => {
    expect(filledSentence(item.es, 'altas')).toBe('Las chicas son altas .');
  });
});

describe('typed noun form', () => {
  const item = { answer: 'las ciudades', accept: undefined };
  it('needs the article and the plural together', () => {
    expect(isNounAnswerRight('las ciudades', item, true)).toBe(true);
    expect(isNounAnswerRight('Las Ciudades.', item, true)).toBe(true);
    expect(isNounAnswerRight('ciudades', item, true)).toBe(false);
    expect(isNounAnswerRight('la ciudades', item, true)).toBe(false);
    expect(isNounAnswerRight('las ciudad', item, true)).toBe(false);
  });
});
