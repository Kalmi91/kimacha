import { words, findWordById, findWordByText, getWordsForLevel, normalizeWordToken } from '@/data/words';

// FB129/FB130, Kálmán 2026-08-15: "nem adja be a szavakat, azt irja mára már kész
// közbe még semmit sem tanultam", and the decisive clue, "a B1-es szavak működnek
// de a kisebb szinten lévő szavak nem". B1 has no Hungarian branch yet, so it falls
// back to the shared Spanish set whose ids the queue could resolve; A0/A1 use the
// Hungarian branch (ids 6001+), which the shared set does not contain, so every
// card was dropped and the session started empty.
describe('word lookup by id across branches', () => {
  it('resolves a Hungarian-branch card that the shared set does not know', () => {
    const huA0 = getWordsForLevel('A0', 'hu');
    const first = huA0[0];
    expect(words.find((w) => w.id === first.id)).toBeUndefined();
    expect(findWordById(first.id, 'hu')?.hu).toBe(first.hu);
  });

  it('resolves every authored branch card, Hungarian and English', () => {
    for (const [lang, levels] of [['hu', ['A0', 'A1']], ['en', ['A0', 'A1', 'A2']]] as const) {
      for (const level of levels) {
        const unresolved = getWordsForLevel(level as any, lang).filter(
          (w) => findWordById(w.id, lang)?.id !== w.id
        );
        expect(`${lang} ${level}: ${unresolved.length}`).toBe(`${lang} ${level}: 0`);
      }
    }
  });

  it('still resolves the shared Spanish set, and does so for a Spanish target', () => {
    const shared = getWordsForLevel('A1', 'es')[0];
    expect(findWordById(shared.id, 'es')?.es).toBe(shared.es);
    // A level with no branch content falls back to the shared set (B1 today).
    const b1 = getWordsForLevel('B1', 'hu')[0];
    expect(findWordById(b1.id, 'hu')?.es).toBe(b1.es);
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

  it('searches the branch being learned, not only the shared set', () => {
    const huA1 = getWordsForLevel('A1', 'hu')[0];
    expect(findWordByText(huA1.hu, 'hu', 'hu')?.id).toBe(huA1.id);
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
