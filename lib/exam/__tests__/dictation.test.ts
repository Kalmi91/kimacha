// Comparing text dictated with the keyboard microphone
// to the expected sentence: case and punctuation do not matter, accents follow the "Accents count"
// setting, the differing words are highlighted on both sides.

import { compareDictation } from '../dictation';

const loose = { strictAccents: false } as const;
const strict = { strictAccents: true } as const;
const words = (list: { text: string; ok: boolean }[]) => list.map((w) => w.text);

describe('compareDictation: case, punctuation', () => {
  it('the exact sentence is right', () => {
    const r = compareDictation('Yo como en casa.', 'Yo como en casa.', strict);
    expect(r).toMatchObject({ correct: true, missing: [], extra: [] });
    expect(r.expected.every((w) => w.ok)).toBe(true);
    expect(r.heard.every((w) => w.ok)).toBe(true);
  });

  it('case does not matter (the keyboard capitalizes the start of the sentence)', () => {
    expect(compareDictation('yo como en casa', 'Yo como en casa.', strict).correct).toBe(true);
    expect(compareDictation('YO COMO EN CASA', 'Yo como en casa', strict).correct).toBe(true);
  });

  it('punctuation does not matter: period, comma, question and exclamation mark, quote, dash', () => {
    expect(compareDictation('donde vives', '¿Dónde vives?', loose).correct).toBe(true);
    expect(compareDictation('Hola, como estas!', 'Hola como estás', loose).correct).toBe(true);
    expect(compareDictation('"Vivo aquí".', 'Vivo aquí', strict).correct).toBe(true);
    expect(compareDictation('vivo - aquí', 'Vivo aquí', strict).correct).toBe(true);
  });

  it('multiple spaces between words and line breaks do not matter', () => {
    expect(compareDictation('  yo   como\nen casa ', 'Yo como en casa.', strict).correct).toBe(true);
  });

  it('the apostrophe and the hyphen are part of the word (English)', () => {
    expect(compareDictation("i don't know", "I don't know.", loose).correct).toBe(true);
    expect(compareDictation('i dont know', "I don't know.", loose).correct).toBe(false);
  });

  it('the keyboard curly apostrophe (’) is the same as the straight one', () => {
    expect(compareDictation('I don’t know', "I don't know.", loose).correct).toBe(true);
  });
});

describe('compareDictation: accent per the "Accents count" setting', () => {
  it('accent strictness OFF: a missing accent is not an error', () => {
    expect(compareDictation('donde esta el bano', '¿Dónde está el baño?', loose).correct).toBe(false); // ñ is a separate letter
    expect(compareDictation('donde esta el baño', '¿Dónde está el baño?', loose).correct).toBe(true);
    expect(compareDictation('ella esta aqui', 'Ella está aquí', loose).correct).toBe(true);
  });

  it('accent strictness ON: a missing accent is an error, and the word is marked as differing', () => {
    const r = compareDictation('ella esta aqui', 'Ella está aquí', strict);
    expect(r.correct).toBe(false);
    expect(r.missing).toEqual(['está', 'aquí']);
    expect(r.extra).toEqual(['esta', 'aqui']);
  });

  it('accent strictness ON: a sentence dictated with the accent is right', () => {
    expect(compareDictation('ella está aquí', 'Ella está aquí', strict).correct).toBe(true);
  });

  it('ñ is a separate letter, not an accent: año does not match ano even with accent strictness OFF', () => {
    expect(compareDictation('tengo un ano', 'Tengo un año', loose)).toMatchObject({ correct: false, missing: ['año'], extra: ['ano'] });
    expect(compareDictation('tengo un año', 'Tengo un año', loose).correct).toBe(true);
  });

  it('the uppercase accented and the decomposed (NFD) form also match', () => {
    expect(compareDictation('ÉL ESTÁ AQUÍ', 'Él está aquí', strict).correct).toBe(true);
    expect(compareDictation('él está', 'Él está', strict).correct).toBe(true);
  });
});

describe('compareDictation: list of differing words', () => {
  it('one wrong word: missing on the expected side, extra on the dictated side', () => {
    const r = compareDictation('yo bebo en casa', 'Yo como en casa.', loose);
    expect(r.correct).toBe(false);
    expect(r.missing).toEqual(['como']);
    expect(r.extra).toEqual(['bebo']);
    expect(r.expected.map((w) => w.ok)).toEqual([true, false, true, true]);
    expect(r.heard.map((w) => w.ok)).toEqual([true, false, true, true]);
  });

  it('omitted word: marked only on the expected side', () => {
    const r = compareDictation('yo en casa', 'Yo como en casa.', loose);
    expect(r).toMatchObject({ correct: false, missing: ['como'], extra: [] });
    expect(words(r.heard)).toEqual(['yo', 'en', 'casa']);
  });

  it('extra word: marked only on the dictated side', () => {
    const r = compareDictation('yo como mucho en casa', 'Yo como en casa.', loose);
    expect(r).toMatchObject({ correct: false, missing: [], extra: ['mucho'] });
  });

  it('the display gives the original spelling (with punctuation), the marking is at word level', () => {
    const r = compareDictation('donde viven', '¿Dónde vives?', loose);
    expect(words(r.expected)).toEqual(['¿Dónde', 'vives?']);
    expect(r.expected.map((w) => w.ok)).toEqual([true, false]);
    expect(r.missing).toEqual(['vives?']);
    expect(r.extra).toEqual(['viven']);
  });

  it('order matters: swapped words count as differing, but the longest common part stays paired', () => {
    const r = compareDictation('casa en como yo', 'Yo como en casa.', loose);
    expect(r.correct).toBe(false);
    expect(r.missing.length).toBeGreaterThan(0);
    expect(r.missing.length).toBe(r.extra.length);
    expect(r.expected.filter((w) => w.ok).length).toBe(1);
  });

  it('for a repeated word only the actually missing instance appears', () => {
    const r = compareDictation('la casa grande', 'La casa casa grande', loose);
    expect(r).toMatchObject({ correct: false, missing: ['casa'], extra: [] });
  });

  it('empty dictation or one of only punctuation: every expected word is missing', () => {
    for (const heard of ['', '   ', '...']) {
      const r = compareDictation(heard, 'Yo como en casa.', loose);
      expect(r.correct).toBe(false);
      expect(r.missing).toEqual(['Yo', 'como', 'en', 'casa.']);
      expect(r.heard).toEqual([]);
    }
  });
});

describe('compareDictation: dropping the Spanish subject pronoun (as with the typed sentence)', () => {
  it('right even without the pronoun, if the setting is on', () => {
    expect(compareDictation('como en casa', 'Yo como en casa.', { strictAccents: false, subjectDrop: true }).correct).toBe(true);
  });

  it('without the setting (e.g. English target language) the missing first word is an error', () => {
    expect(compareDictation('como en casa', 'Yo como en casa.', loose)).toMatchObject({ correct: false, missing: ['Yo'] });
  });

  it('it can be dropped only from the start, and only a pronoun: the lack of any other word stays an error', () => {
    const opts = { strictAccents: false, subjectDrop: true } as const;
    expect(compareDictation('yo como casa', 'Yo como en casa.', opts).correct).toBe(false);
    expect(compareDictation('en casa', 'Mi madre come en casa.', opts).correct).toBe(false);
  });

  it('stays right with the pronoun too', () => {
    expect(compareDictation('yo como en casa', 'Yo como en casa.', { strictAccents: false, subjectDrop: true }).correct).toBe(true);
  });
});
