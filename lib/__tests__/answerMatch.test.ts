import { strictAnswerMatch } from '../answerMatch';

describe('strictAnswerMatch', () => {
  it('rejects a missing verb ending (FB6: "she speak" for "She speaks")', () => {
    expect(strictAnswerMatch('she speak', 'She speaks.')).toBe(false);
  });

  it('rejects a wrong conjugation', () => {
    expect(strictAnswerMatch('yo habla', 'yo hablo')).toBe(false);
  });

  it('forgives case, punctuation and missing accents', () => {
    expect(strictAnswerMatch('como estas', '¿Cómo estás?')).toBe(true);
    expect(strictAnswerMatch('Yo hablo español', 'yo hablo español.')).toBe(true);
  });

  it('forgives a stray space typed inside a word (FB34)', () => {
    expect(strictAnswerMatch('Yo trabajo en una ofi cina.', 'Yo trabajo en una oficina.')).toBe(true);
  });

  it('forgives a double space between words', () => {
    expect(strictAnswerMatch('Yo  hablo   español', 'yo hablo español.')).toBe(true);
  });

  it('rejects missing or extra words', () => {
    expect(strictAnswerMatch('hablo español', 'yo hablo español')).toBe(false);
    expect(strictAnswerMatch('yo hablo mucho español', 'yo hablo español')).toBe(false);
  });

  it('accepts an exact answer', () => {
    expect(strictAnswerMatch('Tú hablas muy bien', 'Tú hablas muy bien.')).toBe(true);
  });
});

// FB132, Kálmán 2026-08-15: "most spanyolba szeretném ha mostantól kezdve az
// ékezetek is hibák lennének, pontosan akarom leírni ... de ezt egy ilyen ki be
// kapcsolható dolognak akarom". Only the accents get stricter, case and
// punctuation stay forgiven either way.
describe('strictAnswerMatch with strict accents (FB132)', () => {
  it('fails a missing accent that the default grader forgives', () => {
    expect(strictAnswerMatch('como estas', '¿Cómo estás?')).toBe(true);
    expect(strictAnswerMatch('como estas', '¿Cómo estás?', { strictAccents: true })).toBe(false);
  });

  it('accepts the accented answer', () => {
    expect(strictAnswerMatch('¿Cómo estás?', '¿Cómo estás?', { strictAccents: true })).toBe(true);
    expect(strictAnswerMatch('el año', 'El año.', { strictAccents: true })).toBe(true);
  });

  it('still forgives case and punctuation', () => {
    expect(strictAnswerMatch('cómo estás', '¿Cómo estás?', { strictAccents: true })).toBe(true);
  });

  it('still forgives a stray space inside a word (FB34)', () => {
    expect(strictAnswerMatch('la ofi cina', 'La oficina.', { strictAccents: true })).toBe(true);
  });

  it('keeps rejecting a wrong letter (FB6)', () => {
    expect(strictAnswerMatch('she speak', 'She speaks', { strictAccents: true })).toBe(false);
  });
});
