import { answerForms, infoButtonVisible, infoRevealsAnswer } from '../infoGate';

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
