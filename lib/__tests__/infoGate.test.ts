import { answerForms, infoButtonVisible, infoRevealsAnswer, questionSentenceOf } from '../infoGate';
import type { PcicItem } from '@/data/pcic';

describe('infoRevealsAnswer', () => {
  it('finds the answer in the text, case- and accent-insensitive, article optional', () => {
    expect(infoRevealsAnswer('La barriga is the belly.', 'la barriga')).toBe(true);
    expect(infoRevealsAnswer('Say BARRIGA for belly.', 'la barriga')).toBe(true);
    expect(infoRevealsAnswer('Also: cancion', 'la canción')).toBe(true);
    expect(infoRevealsAnswer('Not même', 'la canción')).toBe(false);
  });

  it('checks every alternative and bracket form', () => {
    expect(infoRevealsAnswer('Often written coche.', 'el carro / el coche')).toBe(true);
    expect(infoRevealsAnswer('Often written auto.', 'el carro / el coche')).toBe(false);
  });

  it('matches whole words only', () => {
    expect(infoRevealsAnswer('The barrigada is something else.', 'la barriga')).toBe(false);
  });

  it('is false for empty text or empty answer', () => {
    expect(infoRevealsAnswer(undefined, 'la mesa')).toBe(false);
    expect(infoRevealsAnswer('text', undefined)).toBe(false);
    expect(answerForms('')).toEqual([]);
  });
});

describe('infoButtonVisible', () => {
  it('hides the button before Check when the text has the answer, shows it after', () => {
    expect(infoButtonVisible('la barriga is the belly', 'la barriga', false)).toBe(false);
    expect(infoButtonVisible('la barriga is the belly', 'la barriga', true)).toBe(true);
  });

  it('keeps the button when the text does not have the answer', () => {
    expect(infoButtonVisible('Same meal, two English words.', 'la cena', false)).toBe(true);
  });
});

describe('plural forms', () => {
  it('matches form + s / es, with a length guard for short words', () => {
    expect(infoRevealsAnswer('Las barrigas hurt.', 'la barriga')).toBe(true);
    expect(infoRevealsAnswer('Many papeles.', 'el papel')).toBe(true);
    expect(infoRevealsAnswer('Two pies.', 'el pie')).toBe(false);
  });
});

describe('questionSentenceOf', () => {
  const base = { es: 'la barriga', en: 'belly', kind: 'word', section: '', order: 1, id: 'o1' } as PcicItem;
  it('returns the prompt-language sentence', () => {
    expect(questionSentenceOf({ ...base, exampleEn: 'My belly hurts.' }, 'en', 'la barriga')).toBe('My belly hurts.');
  });
  it('is absent when the card has a hint or is a sentence card', () => {
    expect(questionSentenceOf({ ...base, exampleEn: 'My *belly* hurts.', hint: 'My *belly* hurts.' }, 'en', 'la barriga')).toBeUndefined();
    expect(questionSentenceOf({ ...base, kind: 'sentence', exampleEn: 'x y' } as PcicItem, 'en', 'la barriga')).toBeUndefined();
  });
  it('is absent when the sentence contains the answer (loanword, hu->es)', () => {
    expect(questionSentenceOf({ ...base, es: 'el taco', en: 'taco', exampleEn: 'I eat a taco.' }, 'en', 'el taco')).toBeUndefined();
    expect(questionSentenceOf({ ...base, exampleHu: 'Fáj a barriga.' }, 'hu', 'la barriga')).toBeUndefined();
    expect(questionSentenceOf({ ...base, exampleHu: 'Fáj a hasam.' }, 'hu', 'la barriga')).toBe('Fáj a hasam.');
  });
  it('works es->en and de->es', () => {
    expect(questionSentenceOf({ ...base, exampleEs: 'Me duele la barriga.' }, 'es', 'belly')).toBe('Me duele la barriga.');
    expect(questionSentenceOf({ ...base, exampleDe: 'Mein Bauch tut weh.' }, 'de', 'la barriga')).toBe('Mein Bauch tut weh.');
  });
});