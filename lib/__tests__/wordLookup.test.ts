import { words, findWordById, findWordByText, getWordsForLevel, normalizeWordToken } from '@/data/words';

// Play-vágás 7. lépés (2026-09-23): FB129/FB130 (Kálmán 2026-08-15) drove the
// branch-first id lookup this described, resolving a Hungarian-branch card
// the shared set did not know. That branch is gone from the loader now (the
// app runs a single en-es pair), so only the shared-set resolution it always
// also covered stays here.
describe('word lookup by id', () => {
  it('resolves the shared Spanish set for a Spanish target', () => {
    const shared = getWordsForLevel('A1', 'es')[0];
    expect(findWordById(shared.id, 'es')?.es).toBe(shared.es);
  });
});

// FB150, Kálmán 2026-08-22 (`sentence:El calabacín es una verdura verde.`): a tap
// on any word of a sentence has to find that word's card, so it can go into the
// spelling list.
describe('word lookup by text', () => {
  it('finds a headword through case and sentence punctuation', () => {
    expect(findWordByText('YO HABLO', 'es', 'es')?.id).toBe(1001);
    expect(findWordByText('Yo hablo.', 'es', 'es')?.id).toBe(1001);
  });

  it('finds the card of a token that is the tail of a multi-word headword', () => {
    // The sentence says "hablas", the card is headed "tú hablas".
    expect(findWordByText('hablas,', 'es', 'es')?.id).toBe(1002);
  });

  it('finds a headword whose card carries an article the sentence dropped', () => {
    const withArticle = words.find(w => /^(el|la|los|las) /.test(w.es));
    expect(withArticle).toBeDefined();
    const bare = withArticle!.es.replace(/^(el|la|los|las) /, '');
    expect(findWordByText(bare, 'es', 'es')?.id).toBe(withArticle!.id);
    expect(findWordByText(withArticle!.es, 'es', 'es')?.id).toBe(withArticle!.id);
  });

  it('matches the language the tapped text is written in, on both sides of a card', () => {
    expect(findWordByText('I speak', 'en', 'es')?.id).toBe(1001);
    expect(findWordByText('én beszélek', 'hu', 'es')?.id).toBe(1001);
  });

  it('reports no card instead of guessing one', () => {
    expect(findWordByText('zzzqqq', 'es', 'es')).toBeUndefined();
    expect(findWordByText('   ', 'es', 'es')).toBeUndefined();
  });

  it('normalizes a token the same way the tap markers do', () => {
    expect(normalizeWordToken('¿Cuándo?')).toBe('cuándo');
    expect(normalizeWordToken('  El   Gato, ')).toBe('el gato');
  });
});
