import { matchSpoken, normalizeSpoken, numberWords } from '../situationMatch';

describe('numberWords', () => {
  it.each([
    [0, 'cero'],
    [2, 'dos'],
    [16, 'dieciseis'],
    [22, 'veintidos'],
    [30, 'treinta'],
    [31, 'treinta y uno'],
    [99, 'noventa y nueve'],
    [100, 'cien'],
  ])('%i is "%s"', (n, words) => {
    expect(numberWords(n)).toBe(words);
  });
});

describe('normalizeSpoken', () => {
  it('lower case, no accents, no ¿?¡!.,;:, single spaces', () => {
    expect(normalizeSpoken('  ¿Dónde   viven tus Papás?  ')).toBe('donde viven tus papas');
    expect(normalizeSpoken('¡Sí, tengo; un hermano: y una hermana!.')).toBe('si tengo un hermano y una hermana');
    expect(normalizeSpoken('Hungría')).toBe('hungria');
  });

  it('digits 0-100 become Spanish number words, bigger numbers stay', () => {
    expect(normalizeSpoken('Mi hermano tiene 30 años')).toBe('mi hermano tiene treinta anos');
    expect(normalizeSpoken('tengo 2 hermanos')).toBe('tengo dos hermanos');
    expect(normalizeSpoken('31')).toBe('treinta y uno');
    expect(normalizeSpoken('100.')).toBe('cien');
    expect(normalizeSpoken('1999')).toBe('1999');
  });
});

describe('matchSpoken', () => {
  const ANSWERS = ['Mi hermano tiene treinta años.', 'Tiene treinta años.'];

  it('right: the sentence said without accents or punctuation, every word green', () => {
    const m = matchSpoken('mi hermano tiene treinta anos', ANSWERS);
    expect(m.right).toBe(true);
    expect(m.best).toBe('Mi hermano tiene treinta años.');
    expect(m.words).toEqual([
      { word: 'Mi', right: true },
      { word: 'hermano', right: true },
      { word: 'tiene', right: true },
      { word: 'treinta', right: true },
      { word: 'años', right: true },
    ]);
  });

  it('the closest answer wins: the short form is right on its own', () => {
    const m = matchSpoken('tiene treinta años', ANSWERS);
    expect(m.right).toBe(true);
    expect(m.best).toBe('Tiene treinta años.');
  });

  it('one word wrong: not right, that word is red, the others green', () => {
    const m = matchSpoken('mi hermano tiene treinta amigos', ['Mi hermano tiene treinta años.']);
    expect(m.right).toBe(false);
    expect(m.best).toBe('Mi hermano tiene treinta años.');
    expect(m.words.map((w) => w.right)).toEqual([true, true, true, true, false]);
  });

  it('words in the wrong order or missing are red, extra words said do no harm', () => {
    expect(matchSpoken('hermano mi tiene treinta años', ['Mi hermano tiene treinta años.']).right).toBe(false);
    expect(matchSpoken('', ['Mi hermano tiene treinta años.']).words.every((w) => !w.right)).toBe(true);
    expect(matchSpoken('pues sí tengo un hermano y una hermana también', ['Sí, tengo un hermano y una hermana.']).right).toBe(true);
  });

  it('a leading subject pronoun may be left out, and then it is not red', () => {
    const m = matchSpoken('tengo un hermano', ['Yo tengo un hermano.']);
    expect(m.right).toBe(true);
    expect(m.words).toEqual([
      { word: 'Yo', right: true },
      { word: 'tengo', right: true },
      { word: 'un', right: true },
      { word: 'hermano', right: true },
    ]);
    expect(matchSpoken('yo tengo un hermano', ['Yo tengo un hermano.']).right).toBe(true);
  });

  it('any number word 1-100 matches the number of the answer: 30 -> dos, as digits or as words', () => {
    expect(matchSpoken('mi hermano tiene 2 años', ANSWERS).right).toBe(true);
    expect(matchSpoken('mi hermano tiene dos años', ANSWERS).right).toBe(true);
    expect(matchSpoken('mi hermano tiene 31 años', ANSWERS).right).toBe(true);
    expect(matchSpoken('mi hermano tiene treinta y un años', ANSWERS).right).toBe(true);
    expect(matchSpoken('tiene 100 años', ANSWERS).right).toBe(true);
    // a number is still needed, and "y" between two other words is just "y"
    expect(matchSpoken('mi hermano tiene años', ANSWERS).right).toBe(false);
    expect(matchSpoken('un hermano y una hermana', ['Un hermano y una hermana.']).right).toBe(true);
  });

  it('the first of equally close answers is the one that is shown (the model answer goes first)', () => {
    const m = matchSpoken('', ['Sí, tengo un hermano.', 'No, no tengo hermanos.']);
    expect(m.best).toBe('Sí, tengo un hermano.');
  });

  it('no expected sentence: nothing is right', () => {
    expect(matchSpoken('hola', [])).toEqual({ right: false, best: '', words: [] });
  });
});
