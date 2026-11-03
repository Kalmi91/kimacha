import deNounPlurals from '@/data/de/plurals.json';
import { getDeWords } from '@/data/deWords';
import { findWordByText, normalizeWordToken } from '@/data/words';
import { cumulativeCorpusWordIds } from '@/lib/games/content';
import { DE_GRAMMAR_INDEX } from '@/lib/games/content/de.index';
import { buildGlossMap, resolveGloss } from '@/lib/games/gloss';

const find = (token: string) => findWordByText(token, 'de', 'de');

// Tapping a word in a German lesson shows its meaning from the German deck (data/words/de, A1 - C1), the way the Spanish and the
// Hungarian lessons do from their decks. An inflected form finds the card of its dictionary form (lib/deForms.ts).
describe('word lookup in the German course', () => {
  it('finds a headword with and without the article, through case and sentence punctuation', () => {
    expect(find('Hund')?.de).toBe('der Hund');
    expect(find('der Hund')?.de).toBe('der Hund');
    expect(find('Hund,')?.de).toBe('der Hund');
    expect(find('Guten')?.de).toBe('gut');
    expect(find('Leute')?.de).toBe('die Leute (Pl.)');
  });

  it('finds the card of an inflected form: plural, verb forms, participle, adjective endings', () => {
    expect(find('Hunde')?.de).toMatch(/Hund/);
    expect(find('Häuser')?.de).toMatch(/Häuser|Haus/);
    expect(find('Kinder')?.de).toMatch(/Kinder|Kind/);
    // gehen / fahren: present, preterite, participle
    for (const form of ['geht', 'gehst', 'ging', 'gegangen']) expect(find(form)?.de).toBe('gehen / fahren');
    // a stem change: essen > isst
    expect(find('isst')?.de).toBe('essen');
    expect(find('schönen')?.de).toMatch(/schön/);
    expect(find('schöner')?.de).toMatch(/schön/);
    expect(find('bin')?.de).toMatch(/^sein/);
    expect(find('ist')?.de).toMatch(/^sein/);
    expect(find('Angestellten')?.de).toMatch(/Angestellte/);
  });

  it('the plural of every noun of the deck finds a card with that noun, or a card of that plural of its own', () => {
    const plurals = deNounPlurals as Record<string, string[]>;
    const wrong: string[] = [];
    let checked = 0;
    for (const w of getDeWords()) {
      const m = /^(?:der|die|das) ([A-ZÄÖÜ][a-zäöüß]+)$/.exec(w.de as string);
      if (!m || w.pos !== 'noun') continue;
      for (const plural of plurals[m[1].toLowerCase()] ?? []) {
        checked++;
        const head = (find(plural[0].toUpperCase() + plural.slice(1))?.de ?? '').toString().toLowerCase();
        if (!head.includes(m[1].toLowerCase()) && !head.includes(plural)) wrong.push(`${plural} -> ${head}`);
      }
    }
    expect(checked).toBeGreaterThan(300);
    // the table has a few plurals that are nobody's plural ("mathematiken", "folieen"); the lookup does not guess either
    expect(wrong.length).toBeLessThan(checked * 0.02);
  });

  it('tells a noun from a verb by its capital letter: Essen is the food, essen the verb', () => {
    expect(find('Essen')?.de).toMatch(/^das Essen/);
    expect(find('essen')?.de).toBe('essen');
    // at the start of a sentence a verb is capitalised too, and still found
    expect(find('Isst')?.de).toBe('essen');
  });

  it('a word that is a card of its own wins over the form of another card', () => {
    // "heiß" is the adjective, not the imperative of "heißen"
    expect(find('heiß')?.de).toBe('heiß / warm');
    expect(find('heißt')?.de).toBe('heißen');
  });

  it('does not make up a card: an unknown word and the forms of a phrase find nothing', () => {
    expect(find('zzzqqq')).toBeUndefined();
    expect(find('   ')).toBeUndefined();
    expect(find('Deutschland')).toBeUndefined();
    // "anführen / an der Spitze stehen" is no meaning of "steht"
    expect(find('steht')?.de ?? '').not.toContain('Spitze');
    expect(find('dir')?.de).toBe('dich / dir');
  });

  it('every headword of the deck is found, each alternative of an "x / y" one', () => {
    const missing = getDeWords().flatMap((w) =>
      (w.de as string)
        .split(' / ')
        .map((alt) => alt.replace(/\([^)]*\)/g, ' '))
        .filter((alt) => !find(alt)),
    );
    expect(missing).toEqual([]);
  });

  it('never answers with a Spanish card, and leaves the other branches alone', () => {
    expect(getDeWords().every((w) => (w.id as number) >= 100000)).toBe(true);
    expect(find('yo')).toBeUndefined();
    expect(findWordByText('yo', 'es', 'es')?.id).toBe(1);
    expect(findWordByText('Hund', 'de', 'es')).toBeUndefined();
    // the learner's own text in the German course: found in that field of the German deck, never through words-open
    expect(findWordByText('perro', 'es', 'de')?.de).toBe('der Hund');
    expect(findWordByText('hablé', 'es', 'de')?.id).toBeGreaterThanOrEqual(100000);
    expect(findWordByText('zzzqqq', 'es', 'de')).toBeUndefined();
  });
});

describe('resolveGloss in a German lesson', () => {
  it('shows the meaning in the learner\'s language from the German deck', () => {
    const es = resolveGloss('Hund', { learnedLang: 'de', nativeLang: 'es' });
    const en = resolveGloss('Hund', { learnedLang: 'de', nativeLang: 'en' });
    const hu = resolveGloss('Hund', { learnedLang: 'de', nativeLang: 'hu' });
    expect(es).toMatchObject({ learned: 'der Hund', native: 'el perro', isNew: true });
    expect(en?.native).toBe('dog');
    expect(hu?.native).toBe('kutya');
  });

  it('the lesson\'s own glossary wins over the deck, and covers a word the deck lacks', () => {
    const overrides = { hund: { en: 'dog (of the lesson)' }, bratwurst: { en: 'grilled sausage' } };
    expect(resolveGloss('Hund', { learnedLang: 'de', nativeLang: 'en', overrides })?.native).toBe('dog (of the lesson)');
    expect(resolveGloss('Bratwurst', { learnedLang: 'de', nativeLang: 'en', overrides })?.native).toBe('grilled sausage');
  });

  it('a card of the German deck is known up to its level, not marked new', () => {
    const atA1 = cumulativeCorpusWordIds('A1', 'de');
    const atB1 = cumulativeCorpusWordIds('B1', 'de');
    const dog = find('Hund')!;
    expect(atA1.has(dog.id)).toBe(true);
    expect(resolveGloss('Hund', { learnedLang: 'de', nativeLang: 'es', knownWordIds: atA1 })?.isNew).toBe(false);
    expect(atA1.size).toBe(getDeWords().filter((w) => w.level === 'A1').length);
    expect(atB1.size).toBe(getDeWords().filter((w) => ['A1', 'A2', 'B1'].includes(w.level as string)).length);
    // a C1 card is new at B1
    const c1 = getDeWords().find((w) => w.level === 'C1' && w.pos === 'noun')!;
    expect(atB1.has(c1.id)).toBe(false);
    expect(cumulativeCorpusWordIds('A1', 'es').has(dog.id)).toBe(false);
  });
});

describe('a separable verb in a German lesson sentence', () => {
  const opts = { learnedLang: 'de', nativeLang: 'en' } as const;

  it('shows the whole verb for the finite form and for the detached prefix', () => {
    const map = buildGlossMap('Ich stehe um sieben Uhr auf.', opts);
    expect(map.get('stehe')?.learned).toBe('aufstehen');
    expect(map.get('auf')?.learned).toBe('aufstehen');
    expect(map.get('auf')?.native).toBe('to get up');
    expect(map.get('uhr')?.learned).toMatch(/Uhr/);
  });

  it('leaves a preposition alone where no prefix closes the clause', () => {
    const map = buildGlossMap('Das Buch steht auf dem Tisch.', opts);
    expect(map.get('auf')?.learned).toBe('auf / über');
    expect(map.get('tisch')?.learned).toBe('der Tisch');
  });

  it('other branches are glossed exactly as before', () => {
    expect(buildGlossMap('Yo hablo español', { learnedLang: 'es', nativeLang: 'en' }).get('yo')?.wordId).toBe(1);
  });
});

describe('the examples of the German lessons', () => {
  const lessons = DE_GRAMMAR_INDEX.map((e) => ({
    id: e.id,
    lesson: e.load() as unknown as { level?: string; items: { examples?: string[] }[] },
  }));

  function share(of: typeof lessons): { tokens: number; glossed: number } {
    let tokens = 0;
    let glossed = 0;
    for (const { lesson } of of) {
      for (const item of lesson.items) {
        for (const ex of item.examples ?? []) {
          const map = buildGlossMap(ex, { learnedLang: 'de', nativeLang: 'es' });
          for (const raw of ex.split(/\s+/)) {
            const norm = normalizeWordToken(raw);
            if (!norm) continue;
            tokens++;
            if (map.has(norm)) glossed++;
          }
        }
      }
    }
    return { tokens, glossed };
  }

  it('every lesson that has worked examples gets some of their words glossed from the deck', () => {
    const bare = lessons.filter((l) => {
      const { tokens, glossed } = share([l]);
      return tokens > 0 && glossed === 0;
    });
    expect(bare.map((l) => l.id)).toEqual([]);
  });

  it('most of the example words are in the deck, inflected forms included', () => {
    const { tokens, glossed } = share(lessons);
    expect(tokens).toBeGreaterThan(500);
    expect(glossed / tokens).toBeGreaterThan(0.7);
  });
});
