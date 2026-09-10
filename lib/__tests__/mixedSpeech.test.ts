import { isLearnedToken, splitByLanguage } from '@/lib/mixedSpeech';

const hu = { learnedLang: 'es', nativeLang: 'hu' };

describe('isLearnedToken', () => {
  it('claims a Spanish corpus word for the Spanish voice', () => {
    expect(isLearnedToken('casa', hu)).toBe(true);
    expect(isLearnedToken('perro', hu)).toBe(true);
  });

  it('leaves a plain Hungarian word to the native voice', () => {
    expect(isLearnedToken('dolog', hu)).toBe(false);
    expect(isLearnedToken('személy', hu)).toBe(false);
  });

  it('forgives punctuation glued to the word', () => {
    expect(isLearnedToken('(casa,', hu)).toBe(true);
  });

  it('never switches when both languages are the same', () => {
    expect(isLearnedToken('casa', { learnedLang: 'es', nativeLang: 'es' })).toBe(false);
  });
});

describe('splitByLanguage', () => {
  it('reads the explanation natively and the example in Spanish', () => {
    const segments = splitByLanguage('Névelő áll előtte: la casa.', hu);
    expect(segments.map((s) => s.lang)).toEqual(['hu', 'es']);
    expect(segments[1].text).toBe('la casa.');
  });

  it('keeps a run of Spanish words in one segment', () => {
    const segments = splitByLanguage('Példa: el perro grande corre.', hu);
    expect(segments).toHaveLength(2);
    expect(segments[1].text).toBe('el perro grande corre.');
  });

  it('returns one segment for text with no Spanish in it', () => {
    const segments = splitByLanguage('Ez a mondat teljesen magyar.', hu);
    expect(segments).toHaveLength(1);
    expect(segments[0].lang).toBe('hu');
  });

  it('keeps every word, in order', () => {
    const text = 'FŐNÉV: dolog vagy személy (casa, perro). Névelő áll előtte: la casa.';
    const words = splitByLanguage(text, hu)
      .map((s) => s.text)
      .join(' ')
      .split(/\s+/);
    expect(words).toEqual(text.split(/\s+/));
  });

  it('drops nothing but whitespace on an empty input', () => {
    expect(splitByLanguage('   ', hu)).toEqual([]);
  });
});

// A függő szavak (névelő, elöljáró) a szomszédjuktól kapják a nyelvet.
describe('function words', () => {
  it('pulls the article into the Spanish run', () => {
    expect(splitByLanguage('Például: el perro.', hu).map((s) => s.text)).toEqual(['Például:', 'el perro.']);
  });

  it('leaves a lone Hungarian "de" with the native voice', () => {
    const segments = splitByLanguage('Ez így van, de nem mindig.', hu);
    expect(segments).toHaveLength(1);
    expect(segments[0].lang).toBe('hu');
  });

  it('joins a preposition sitting between two Spanish words', () => {
    const segments = splitByLanguage('Például: casa de campo.', hu);
    expect(segments[segments.length - 1].text).toBe('casa de campo.');
  });
});
