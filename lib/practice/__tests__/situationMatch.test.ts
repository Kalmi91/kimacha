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

  describe('numbers', () => {
    const ANY = { anyNumber: true };

    it('without anyNumber the number has to be the one of the sentence, said as digits or as words', () => {
      expect(matchSpoken('mi hermano tiene 30 años', ANSWERS).right).toBe(true);
      expect(matchSpoken('mi hermano tiene treinta años', ANSWERS).right).toBe(true);
      expect(matchSpoken('mi hermano tiene 2 años', ANSWERS).right).toBe(false);
      expect(matchSpoken('mi hermano tiene dos años', ANSWERS).right).toBe(false);
      expect(matchSpoken('mi hermano tiene 31 años', ANSWERS).right).toBe(false);
      // the wrong number is the red word
      expect(matchSpoken('mi hermano tiene 2 años', ['Mi hermano tiene treinta años.']).words.map((w) => w.right)).toEqual([true, true, true, false, true]);
      // 31 is "treinta y uno" is "treinta y un"
      expect(matchSpoken('tiene treinta y un años', ['Tiene 31 años.']).right).toBe(true);
      expect(matchSpoken('tiene treinta y uno años', ['Tiene 31 años.']).right).toBe(true);
      expect(matchSpoken('tiene 31 años', ['Tiene 31 años.']).right).toBe(true);
    });

    it('with anyNumber any number 1-100 matches the number of the answer: 30 -> dos, as digits or as words', () => {
      expect(matchSpoken('mi hermano tiene 2 años', ANSWERS, ANY).right).toBe(true);
      expect(matchSpoken('mi hermano tiene dos años', ANSWERS, ANY).right).toBe(true);
      expect(matchSpoken('mi hermano tiene 31 años', ANSWERS, ANY).right).toBe(true);
      expect(matchSpoken('mi hermano tiene treinta y un años', ANSWERS, ANY).right).toBe(true);
      expect(matchSpoken('tiene 100 años', ANSWERS, ANY).right).toBe(true);
      // a number is still needed, and "y" between two other words is just "y"
      expect(matchSpoken('mi hermano tiene años', ANSWERS, ANY).right).toBe(false);
      expect(matchSpoken('un hermano y una hermana', ['Un hermano y una hermana.'], ANY).right).toBe(true);
    });

    it('veintiún is a number word (21, before a noun)', () => {
      expect(normalizeSpoken('veintiún')).toBe('veintiun');
      expect(matchSpoken('tiene veintiún años', ['Tiene 21 años.']).right).toBe(true);
      expect(matchSpoken('tiene veintiún años', ['Tiene treinta años.']).right).toBe(false);
      expect(matchSpoken('tiene veintiún años', ['Tiene treinta años.'], ANY).right).toBe(true);
      expect(matchSpoken('tiene veintiuno años', ['Tiene veintiún años.']).right).toBe(true);
    });
  });

  describe('uno for un / una', () => {
    it('a heard uno, also from the digit 1, matches the article un / una of the sentence', () => {
      expect(matchSpoken('tengo uno hermano', ['Tengo un hermano.']).right).toBe(true);
      expect(matchSpoken('tengo 1 hermano', ['Tengo un hermano.']).right).toBe(true);
      expect(matchSpoken('tengo 1 hermana', ['Tengo una hermana.']).right).toBe(true);
      expect(matchSpoken('tengo 1 hermano y 1 hermana', ['Sí, tengo un hermano y una hermana.'], { anyNumber: true }).words.filter((w) => !w.right).map((w) => w.word)).toEqual(['Sí']);
      expect(matchSpoken('sí tengo 1 hermano y 1 hermana', ['Sí, tengo un hermano y una hermana.']).right).toBe(true);
      // only for the article: 1 is not another number
      expect(matchSpoken('tengo 1 hermano', ['Tengo dos hermanos.']).right).toBe(false);
      expect(matchSpoken('tiene 1 años', ['Tiene treinta años.']).right).toBe(false);
    });
  });

  describe('a "no" that is not in the sentence', () => {
    it('makes it wrong, whatever else was said; the other extra words are fine', () => {
      expect(matchSpoken('no tengo un hermano', ['Tengo un hermano.']).right).toBe(false);
      expect(matchSpoken('mis papás no viven en Hungría', ['Mis papás viven en Hungría.']).right).toBe(false);
      expect(matchSpoken('mis papás no viven en Hungría', ['Mis papás viven en Hungría.']).words.every((w) => w.right)).toBe(true);
      expect(matchSpoken('pues mis papás viven en Hungría ya', ['Mis papás viven en Hungría.']).right).toBe(true);
    });

    it('a "no" the sentence has is needed once for each', () => {
      expect(matchSpoken('no tengo hermanos', ['No tengo hermanos.']).right).toBe(true);
      expect(matchSpoken('no no tengo hermanos', ['No tengo hermanos.']).right).toBe(false);
      expect(matchSpoken('no no tengo hermanos', ['No, no tengo hermanos.']).right).toBe(true);
      expect(matchSpoken('no tengo hermanos', ['No, no tengo hermanos.']).right).toBe(false);
    });

    it('the closest answer wins: "no tengo hermanos" is the short answer, not the long one with a missing "no"', () => {
      const m = matchSpoken('no tengo hermanos', ['Sí, tengo un hermano y una hermana.', 'No, no tengo hermanos.', 'No tengo hermanos.']);
      expect(m.right).toBe(true);
      expect(m.best).toBe('No tengo hermanos.');
      // the model answer of the family lunch: a "no" is wrong, the short forms are right
      expect(matchSpoken('no tengo un hermano', ['Sí, tengo un hermano.', 'Tengo un hermano.', 'No tengo hermanos.']).right).toBe(false);
    });
  });

  it('the first of equally close answers is the one that is shown (the model answer goes first)', () => {
    const m = matchSpoken('', ['Sí, tengo un hermano.', 'No, no tengo hermanos.']);
    expect(m.best).toBe('Sí, tengo un hermano.');
  });

  it('no expected sentence: nothing is right', () => {
    expect(matchSpoken('hola', [])).toEqual({ right: false, best: '', words: [] });
  });
});
