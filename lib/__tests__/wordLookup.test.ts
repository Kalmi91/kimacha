import { findWordByText, normalizeWordToken } from '@/data/words';
import { openWords } from '@/data/openWords';

// FB150, Kálmán 2026-08-22 (`sentence:El calabacín es una verdura verde.`): a tap
// on any word of a sentence has to find that word's card, so it can go into the
// spelling list.
// PLAN-regi-szavak-ki 5. lépés: a szöveg szerinti keresés a words-open kártyáin fut
// (id = a kártya order-e): yo = 1, tal vez = 436.
describe('word lookup by text', () => {
  it('finds a headword through case and sentence punctuation', () => {
    expect(findWordByText('YO', 'es', 'es')?.id).toBe(1);
    expect(findWordByText('Yo.', 'es', 'es')?.id).toBe(1);
  });

  it('finds the card of a token that is the tail of a multi-word headword', () => {
    // The sentence says "perhaps", the card is headed "maybe, perhaps" (tal vez).
    expect(findWordByText('perhaps,', 'en', 'es')?.id).toBe(436);
  });

  it('finds a headword whose card carries an article the sentence dropped', () => {
    const withArticle = openWords.find(w => /^(el|la|los|las) /.test(w.es));
    expect(withArticle).toBeDefined();
    const bare = withArticle!.es.replace(/^(el|la|los|las) /, '');
    expect(findWordByText(bare, 'es', 'es')?.id).toBe(withArticle!.id);
    expect(findWordByText(withArticle!.es, 'es', 'es')?.id).toBe(withArticle!.id);
  });

  it('matches the language the tapped text is written in, on both sides of a card', () => {
    expect(findWordByText('I', 'en', 'es')?.id).toBe(1);
    expect(findWordByText('én', 'hu', 'es')?.id).toBe(1);
  });

  it('reports no card instead of guessing one', () => {
    expect(findWordByText('zzzqqq', 'es', 'es')).toBeUndefined();
    expect(findWordByText('   ', 'es', 'es')).toBeUndefined();
  });

  // A words-open csak tőalakot hordoz; a ragozott, többes és nemi alak a tő kártyájához tartozik
  // (hablar = 47, tener = 16, el amigo = 40, nuevo = 67, la ciudad = 51), de szót, ami nincs a
  // words-openben, nem talál ki.
  it('finds the headword card of a conjugated, plural or feminine form', () => {
    expect(findWordByText('hablé', 'es', 'es')?.id).toBe(47);
    expect(findWordByText('Hablaremos.', 'es', 'es')?.id).toBe(47);
    expect(findWordByText('tuvo', 'es', 'es')?.id).toBe(16);
    expect(findWordByText('amigos', 'es', 'es')?.id).toBe(40);
    expect(findWordByText('los amigos', 'es', 'es')?.id).toBe(40);
    expect(findWordByText('nuevas', 'es', 'es')?.id).toBe(67);
    expect(findWordByText('ciudades', 'es', 'es')?.id).toBe(51);
    expect(findWordByText('hablé', 'hu', 'es')).toBeUndefined();
  });

  it('does not gloss a form of a word that is not in the list', () => {
    expect(openWords.some(w => w.lemma === 'patinar')).toBe(false);
    expect(findWordByText('patinaba', 'es', 'es')).toBeUndefined();
    expect(findWordByText('patinamos', 'es', 'es')).toBeUndefined();
  });

  it('normalizes a token the same way the tap markers do', () => {
    expect(normalizeWordToken('¿Cuándo?')).toBe('cuándo');
    expect(normalizeWordToken('  El   Gato, ')).toBe('el gato');
  });
});
