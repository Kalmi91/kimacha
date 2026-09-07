import { sentenceBuildMatch, strictAnswerMatch } from '../answerMatch';

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

// FB137, Kálmán 2026-08-16 (easy:"The engine makes a lot of noise."): "nem hace
// kellett volna?? ide szerintem rosszat raktam be és elfogadta". Tap-to-order has
// no typing, so the typing cards' 2-character tolerance must not apply here.
describe('sentenceBuildMatch (FB137)', () => {
  const target = ['El', 'motor', 'hace', 'mucho', 'ruido.'];

  it('rejects a trap tile one character away from the right one', () => {
    expect(sentenceBuildMatch(['El', 'motor', 'hacen', 'mucho', 'ruido.'], target)).toBe(false);
    expect(sentenceBuildMatch(['El', 'motor', 'haces', 'mucho', 'ruido.'], target)).toBe(false);
  });

  it('rejects a wrong order', () => {
    expect(sentenceBuildMatch(['El', 'motor', 'mucho', 'hace', 'ruido.'], target)).toBe(false);
  });

  it('rejects a missing or an extra tile', () => {
    expect(sentenceBuildMatch(['El', 'motor', 'hace', 'ruido.'], target)).toBe(false);
    expect(sentenceBuildMatch(['El', 'El', 'motor', 'hace', 'mucho', 'ruido.'], target)).toBe(false);
  });

  it('accepts the exact build', () => {
    expect(sentenceBuildMatch(target, target)).toBe(true);
  });

  it('forgives case and edge punctuation only', () => {
    expect(sentenceBuildMatch(['el', 'motor', 'hace', 'mucho', 'ruido'], target)).toBe(true);
    expect(sentenceBuildMatch(['¿Tú', 'hablas?'], ['Tú', 'hablas'])).toBe(true);
  });

  it('keeps rejecting a missing accent, the tiles carry it (FB132 spirit)', () => {
    expect(sentenceBuildMatch(['El', 'camion', 'es', 'grande.'], ['El', 'camión', 'es', 'grande.'])).toBe(false);
  });
});

describe('strictAnswerMatch, parenthetical gloss (BUG-001)', () => {
  it('accepts the answer without the gloss', () => {
    expect(strictAnswerMatch('van', 'van (ő)')).toBe(true);
    expect(strictAnswerMatch('óra', 'óra (idő)')).toBe(true);
    expect(strictAnswerMatch('én vagyok', 'én vagyok (állapot)')).toBe(true);
    expect(strictAnswerMatch('ver', 'ver (veremos)')).toBe(true);
  });

  it('still accepts the full form with the gloss typed out', () => {
    expect(strictAnswerMatch('van (ő)', 'van (ő)')).toBe(true);
    expect(strictAnswerMatch('van ő', 'van (ő)')).toBe(true);
  });

  it('does not turn the gloss into an answer of its own', () => {
    expect(strictAnswerMatch('ő', 'van (ő)')).toBe(false);
    expect(strictAnswerMatch('', 'van (ő)')).toBe(false);
    expect(strictAnswerMatch('vagyok', 'van (ő)')).toBe(false);
  });

  it('keeps the FB6 strictness inside the bare form', () => {
    expect(strictAnswerMatch('she speak', 'she speaks (now)')).toBe(false);
  });
});

// German writes ß as ss and an umlaut as vowel+e, and a phone keyboard often
// produces neither. All three spellings are the same word, so all three pass —
// but only while accents are forgiven, and never at the cost of an ending.
describe('strictAnswerMatch, German spellings', () => {
  const de = { lang: 'de' };

  it('accepts ß typed as ss, and back', () => {
    expect(strictAnswerMatch('Strasse', 'die Straße'.split(' ')[1], de)).toBe(true);
    expect(strictAnswerMatch('Straße', 'Straße', de)).toBe(true);
    expect(strictAnswerMatch('grüßen', 'gruessen', de)).toBe(true);
  });

  it('accepts the umlaut, its digraph and the bare vowel', () => {
    for (const typed of ['schön', 'schoen', 'schon']) {
      expect(strictAnswerMatch(typed, 'schön', de)).toBe(true);
    }
    expect(strictAnswerMatch('fuenf Buecher', 'fünf Bücher', de)).toBe(true);
  });

  it('works on a whole sentence', () => {
    expect(strictAnswerMatch('Ich moechte eine grosse Tasse.', 'Ich möchte eine große Tasse.', de)).toBe(true);
  });

  it('does not let the digraph reading eat an ending', () => {
    expect(strictAnswerMatch('neu', 'neue', de)).toBe(false);
    expect(strictAnswerMatch('neue', 'neu', de)).toBe(false);
    expect(strictAnswerMatch('Mutter', 'Mütter', de)).toBe(true); // accents forgiven, as everywhere
  });

  it('holds every word to FB6 strictness', () => {
    expect(strictAnswerMatch('Ich gehe Haus', 'Ich gehe nach Hause', de)).toBe(false);
    expect(strictAnswerMatch('der Tasche', 'die Tasche', de)).toBe(false);
  });

  it('grades ß and the umlaut when strict accents are on', () => {
    expect(strictAnswerMatch('Strasse', 'Straße', { lang: 'de', strictAccents: true })).toBe(false);
    expect(strictAnswerMatch('schoen', 'schön', { lang: 'de', strictAccents: true })).toBe(false);
    expect(strictAnswerMatch('schön', 'schön', { lang: 'de', strictAccents: true })).toBe(true);
  });

  it('leaves other languages alone', () => {
    expect(strictAnswerMatch('schoen', 'schön')).toBe(false);
    expect(strictAnswerMatch('Strasse', 'Straße', { lang: 'es' })).toBe(false);
  });
});
