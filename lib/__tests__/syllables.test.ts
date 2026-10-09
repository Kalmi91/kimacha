// Easy reading: the Spanish syllabifier.
import { syllabify, syllabifyPhrase } from '@/lib/syllables';

describe('syllabify', () => {
  it.each([
    ['carro', ['ca', 'rro']],
    ['perro', ['pe', 'rro']],
    ['ahora', ['a', 'ho', 'ra']],
    ['ciudad', ['ciu', 'dad']],
    ['tren', ['tren']],
  ])('%s -> %j', (word, expected) => {
    expect(syllabify(word)).toEqual(expected);
  });

  it('consonant clusters: staying together (pr, tr, bl) and splitting (rt, nt, st)', () => {
    expect(syllabify('libro')).toEqual(['li', 'bro']);
    expect(syllabify('cuatro')).toEqual(['cua', 'tro']);
    expect(syllabify('tabla')).toEqual(['ta', 'bla']);
    expect(syllabify('puerta')).toEqual(['puer', 'ta']);
    expect(syllabify('mundo')).toEqual(['mun', 'do']);
    expect(syllabify('escuela')).toEqual(['es', 'cue', 'la']);
    expect(syllabify('instrumento')).toEqual(['ins', 'tru', 'men', 'to']);
    expect(syllabify('construir')).toEqual(['cons', 'truir']);
  });

  it('ch, ll, qu, gu are one sound', () => {
    expect(syllabify('mucho')).toEqual(['mu', 'cho']);
    expect(syllabify('calle')).toEqual(['ca', 'lle']);
    expect(syllabify('queso')).toEqual(['que', 'so']);
    expect(syllabify('guitarra')).toEqual(['gui', 'ta', 'rra']);
    expect(syllabify('agua')).toEqual(['a', 'gua']);
  });

  it('a diphthong is one syllable, a hiatus is two', () => {
    expect(syllabify('bueno')).toEqual(['bue', 'no']);
    expect(syllabify('aire')).toEqual(['ai', 're']);
    expect(syllabify('leer')).toEqual(['le', 'er']);
    expect(syllabify('país')).toEqual(['pa', 'ís']);
    expect(syllabify('río')).toEqual(['rí', 'o']);
    expect(syllabify('muy')).toEqual(['muy']);
  });

  it('the original letters (uppercase, accent) stay, the joined syllables give the word', () => {
    expect(syllabify('Carro')).toEqual(['Ca', 'rro']);
    expect(syllabify('ratón')).toEqual(['ra', 'tón']);
    for (const w of ['teléfono', 'mañana', 'universidad', 'Ciudad', 'televisión']) {
      expect(syllabify(w).join('')).toBe(w);
    }
  });

  it('text with no vowel or empty: one piece, or empty', () => {
    expect(syllabify('')).toEqual([]);
    expect(syllabify('pst')).toEqual(['pst']);
  });
});

describe('syllabifyPhrase', () => {
  it('syllabifies word by word, leaves the space and the punctuation as separate elements', () => {
    expect(syllabifyPhrase('el carro')).toEqual([
      { text: 'el', syllables: ['el'] },
      { text: ' ', syllables: null },
      { text: 'carro', syllables: ['ca', 'rro'] },
    ]);
    const parts = syllabifyPhrase('¿cómo estás?');
    expect(parts.map((p) => p.text).join('')).toBe('¿cómo estás?');
    expect(parts.filter((p) => p.syllables).map((p) => p.syllables)).toEqual([['có', 'mo'], ['es', 'tás']]);
  });
});
