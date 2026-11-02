import { germanNumberWords, matchSpoken, normalizeSpoken, numberWords } from '../situationMatch';

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

describe('German: germanNumberWords and normalizeSpoken', () => {
  it.each([
    [0, 'null'],
    [1, 'eins'],
    [5, 'fuenf'],
    [12, 'zwoelf'],
    [16, 'sechzehn'],
    [21, 'einundzwanzig'],
    [30, 'dreissig'],
    [31, 'einunddreissig'],
    [66, 'sechsundsechzig'],
    [99, 'neunundneunzig'],
    [100, 'hundert'],
  ])('%i is "%s"', (n, words) => {
    expect(germanNumberWords(n)).toBe(words);
  });

  it('ä ö ü ß are written ae oe ue ss, the capital does not matter, other accents go, digits become German number words', () => {
    expect(normalizeSpoken('  Wo wohnen Deine   Eltern?  ', 'de')).toBe('wo wohnen deine eltern');
    expect(normalizeSpoken('Ich habe zwei Brüder.', 'de')).toBe('ich habe zwei brueder');
    expect(normalizeSpoken('Die Straße ist schön', 'de')).toBe('die strasse ist schoen');
    expect(normalizeSpoken('Mädchen', 'de')).toBe('maedchen');
    expect(normalizeSpoken('Mein Bruder ist 30 Jahre alt', 'de')).toBe('mein bruder ist dreissig jahre alt');
    expect(normalizeSpoken('„Ja“, sagt er: "nein"!', 'de')).toBe('ja sagt er nein');
    expect(normalizeSpoken('1999', 'de')).toBe('1999');
    // Spanish keeps its own rules
    expect(normalizeSpoken('Mi hermano tiene 30 años')).toBe('mi hermano tiene treinta anos');
  });
});

describe('matchSpoken in German', () => {
  const ANSWERS = ['Mein Bruder ist dreißig Jahre alt.', 'Er ist dreißig Jahre alt.', 'Er ist dreißig.'];
  const de = { lang: 'de' } as const;

  it('right: the sentence as the recognizer writes it, ß and the capitals do not matter', () => {
    const m = matchSpoken('mein bruder ist dreissig jahre alt', ANSWERS, de);
    expect(m.right).toBe(true);
    expect(m.best).toBe('Mein Bruder ist dreißig Jahre alt.');
    expect(m.words).toEqual([
      { word: 'Mein', right: true },
      { word: 'Bruder', right: true },
      { word: 'ist', right: true },
      { word: 'dreißig', right: true },
      { word: 'Jahre', right: true },
      { word: 'alt', right: true },
    ]);
    expect(matchSpoken('Mein Bruder ist dreißig Jahre alt', ANSWERS, de).right).toBe(true);
  });

  it('umlauts typed as ae oe ue are right, a missing umlaut is a different word', () => {
    const one = ['Ja, ich habe zwei Brüder.'];
    expect(matchSpoken('ja ich habe zwei brueder', one, de).right).toBe(true);
    expect(matchSpoken('ja ich habe zwei Brüder', one, de).right).toBe(true);
    const wrong = matchSpoken('ja ich habe zwei bruder', one, de);
    expect(wrong.right).toBe(false);
    expect(wrong.words.filter((w) => !w.right).map((w) => w.word)).toEqual(['Brüder']);
  });

  it('a digit is the number word: 30 is dreißig, a wrong number is wrong unless any number is allowed', () => {
    expect(matchSpoken('er ist 30 jahre alt', ANSWERS, de).right).toBe(true);
    expect(matchSpoken('er ist 31 jahre alt', ANSWERS, de).right).toBe(false);
    expect(matchSpoken('er ist 31 jahre alt', ANSWERS, { ...de, anyNumber: true }).right).toBe(true);
    expect(matchSpoken('er ist einunddreißig', ANSWERS, { ...de, anyNumber: true }).right).toBe(true);
    expect(matchSpoken('er ist dreissig', ANSWERS, de).best).toBe('Er ist dreißig.');
  });

  it('a heard "eins" or the digit 1 matches ein / eine / einen', () => {
    const one = ['Ich habe einen Bruder und eine Schwester.'];
    expect(matchSpoken('ich habe 1 bruder und eine schwester', one, de).right).toBe(true);
    expect(matchSpoken('ich habe eins bruder und eins schwester', one, de).right).toBe(true);
    expect(matchSpoken('ich habe zwei bruder und eine schwester', one, de).right).toBe(false);
  });

  it('a negation the sentence does not have turns it round (nicht, nein, kein...), one it has is fine', () => {
    const yes = ['Ja, ich habe einen Bruder.'];
    expect(matchSpoken('nein ich habe einen bruder', yes, de).right).toBe(false);
    expect(matchSpoken('ich habe keinen bruder', yes, de).right).toBe(false);
    const no = ['Nein, ich habe keine Geschwister.'];
    expect(matchSpoken('nein ich habe keine geschwister', no, de).right).toBe(true);
    // extra words that are no negation do no harm
    expect(matchSpoken('also ja ich habe einen bruder wirklich', yes, de).right).toBe(true);
  });

  it('a German subject pronoun is never dropped (only Spanish may leave it out)', () => {
    const m = matchSpoken('ist dreissig jahre alt', ['Er ist dreißig Jahre alt.'], de);
    expect(m.right).toBe(false);
    expect(m.words[0]).toEqual({ word: 'Er', right: false });
    // the same words in Spanish: the pronoun may go
    expect(matchSpoken('tiene treinta años', ['Él tiene treinta años.']).right).toBe(true);
  });

  it('nothing to compare with: not right, the first expected sentence is the best one', () => {
    expect(matchSpoken('hallo', [], de)).toEqual({ right: false, best: '', words: [] });
  });
});
