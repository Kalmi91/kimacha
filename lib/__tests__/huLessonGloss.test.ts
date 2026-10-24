import { getHuWords } from '@/data/huWords';
import { findWordByText, normalizeWordToken } from '@/data/words';
import { cumulativeCorpusWordIds } from '@/lib/games/content';
import { HU_GRAMMAR_INDEX } from '@/lib/games/content/hu.index';
import { buildGlossMap, resolveGloss } from '@/lib/games/gloss';

// The worked examples of the Hungarian course lessons (data/games/grammar/hu) get their word glosses the way the
// es and en lessons do, from the course's own deck: for es / en that is words-open, for hu the Hungarian deck
// (data/words/hu, A0 + A1), besides the glossary the lesson carries itself.
describe('word lookup in the Hungarian course', () => {
  it('finds a headword, with and without the article the sentence dropped', () => {
    expect(findWordByText('Szia!', 'hu', 'hu')?.es).toBe('hola (informal)');
    expect(findWordByText('cipő', 'hu', 'hu')?.hu).toBe('a cipő');
    expect(findWordByText('az autó', 'hu', 'hu')?.en).toBe('the car');
  });

  it('finds the verb form behind its pronoun, but not the tail of a phrase', () => {
    expect(findWordByText('vannak', 'hu', 'hu')?.hu).toBe('ők vannak');
    // "a fű a kertben" = the grass; "kertben" alone is not that.
    expect(findWordByText('kertben', 'hu', 'hu')).toBeUndefined();
    expect(findWordByText('magyarul', 'hu', 'hu')).toBeUndefined();
  });

  it('every card of the Hungarian deck is found by its own headword', () => {
    const missing = getHuWords().filter((w) => !findWordByText(w.hu as string, 'hu', 'hu'));
    expect(missing.map((w) => w.hu)).toEqual([]);
  });

  it('does not touch the words-open lookup of the other branches', () => {
    expect(findWordByText('yo', 'es', 'es')?.id).toBe(1);
    expect(findWordByText('szia', 'es', 'es')).toBeUndefined();
    expect(findWordByText('yo', 'hu', 'hu')).toBeUndefined();
  });
});

describe('resolveGloss in a Hungarian lesson', () => {
  it('shows the meaning in the learner\'s language from the Hungarian deck', () => {
    const es = resolveGloss('kutya', { learnedLang: 'hu', nativeLang: 'es' });
    const en = resolveGloss('kutya', { learnedLang: 'hu', nativeLang: 'en' });
    expect(es?.native).toBe('el perro');
    expect(en?.native).toBe('the dog');
    expect(es?.isNew).toBe(true);
  });

  it('the lesson\'s own glossary wins over the deck, and covers a word the deck lacks', () => {
    const overrides = { kutya: { es: 'perro (de la lección)' }, gulyás: { es: 'gulash' } };
    expect(resolveGloss('kutya', { learnedLang: 'hu', nativeLang: 'es', overrides })?.native).toBe('perro (de la lección)');
    expect(resolveGloss('gulyás', { learnedLang: 'hu', nativeLang: 'es', overrides })?.native).toBe('gulash');
  });

  it('a card of the Hungarian deck is known up to its level, not marked new', () => {
    const known = cumulativeCorpusWordIds('A1', 'hu');
    const card = findWordByText('kutya', 'hu', 'hu')!;
    expect(known.has(card.id)).toBe(true);
    expect(resolveGloss('kutya', { learnedLang: 'hu', nativeLang: 'es', knownWordIds: known })?.isNew).toBe(false);
    expect(known.size).toBe(getHuWords().length);
    expect(cumulativeCorpusWordIds('A1', 'es').has(card.id)).toBe(false);
  });
});

describe('the examples of the Hungarian lessons', () => {
  const lessons = HU_GRAMMAR_INDEX.map((e) => ({ id: e.id, lesson: e.load() as unknown as { glossary?: { word: string; gloss: Record<string, string> }[]; items: { examples?: string[] }[] } }));

  function glossedFromDeck(lesson: (typeof lessons)[number]['lesson']): { tokens: number; glossed: number } {
    const overrides = Object.fromEntries((lesson.glossary ?? []).map((g) => [normalizeWordToken(g.word), g.gloss]));
    let tokens = 0;
    let glossed = 0;
    for (const item of lesson.items) {
      for (const ex of item.examples ?? []) {
        const map = buildGlossMap(ex, { learnedLang: 'hu', nativeLang: 'es' });
        for (const raw of ex.split(/\s+/)) {
          const norm = normalizeWordToken(raw);
          if (!norm) continue;
          tokens++;
          if (map.has(norm) && !overrides[norm]) glossed++;
        }
      }
    }
    return { tokens, glossed };
  }

  it('every lesson that has worked examples gets some of their words glossed from the deck', () => {
    const bare = lessons.filter(({ lesson }) => {
      const { tokens, glossed } = glossedFromDeck(lesson);
      return tokens > 0 && glossed === 0;
    });
    expect(bare.map((l) => l.id)).toEqual([]);
  });

  it('about half of all example words are in the deck (it was none before the deck was wired in)', () => {
    let tokens = 0;
    let glossed = 0;
    for (const { lesson } of lessons) {
      const r = glossedFromDeck(lesson);
      tokens += r.tokens;
      glossed += r.glossed;
    }
    expect(glossed / tokens).toBeGreaterThan(0.4);
  });
});
