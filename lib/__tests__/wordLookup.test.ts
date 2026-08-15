import { words, findWordById, getWordsForLevel } from '@/data/words';

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
