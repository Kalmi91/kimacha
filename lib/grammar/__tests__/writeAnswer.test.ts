import { isWriteAnswerRight } from '../writeAnswer';

const item = { es: 'Estudio español para viajar a México.', accept: ['Para viajar a México, estudio español.'] };
const withPronoun = { es: 'Ella está cansada hoy.' };

describe('isWriteAnswerRight', () => {
  it('takes the sentence with any case and punctuation', () => {
    expect(isWriteAnswerRight('estudio español para viajar a méxico', item, false)).toBe(true);
  });

  it('forgives every missing accent on the lenient setting, none on the strict one', () => {
    expect(isWriteAnswerRight('Estudio espanol para viajar a Mexico.', item, false)).toBe(true);
    expect(isWriteAnswerRight('Estudio espanol para viajar a Mexico.', item, true)).toBe(false);
    expect(isWriteAnswerRight('Estudio español para viajar a México.', item, true)).toBe(true);
  });

  it('takes an accepted form', () => {
    expect(isWriteAnswerRight('Para viajar a Mexico, estudio espanol', item, false)).toBe(true);
  });

  it('takes the sentence without its leading subject pronoun, also with accents missing', () => {
    expect(isWriteAnswerRight('Está cansada hoy.', withPronoun, true)).toBe(true);
    expect(isWriteAnswerRight('esta cansada hoy', withPronoun, false)).toBe(true);
  });

  it('fails the rule the lesson teaches: por for para, estar for ser', () => {
    expect(isWriteAnswerRight('Estudio español por viajar a México.', item, false)).toBe(false);
    expect(isWriteAnswerRight('Ella es cansada hoy.', withPronoun, false)).toBe(false);
  });

  it('fails an added pronoun that the sentence does not have', () => {
    expect(isWriteAnswerRight('Tú estudio español para viajar a México.', item, false)).toBe(false);
  });
});
