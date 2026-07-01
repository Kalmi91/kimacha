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
