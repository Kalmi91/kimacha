import { findPcicItem, setPcicTarget, type PcicItem } from '@/data/pcic';
import type { ResolvedTense } from '@/lib/knownSentence';
import { sm2NewCard, type Sm2Card } from '@/lib/sm2';
import type { GapSourceInfo } from '../gapFill';
import {
  READING_WORDS,
  buildQuestions,
  buildReadingSet,
  pickReadingWords,
  readingWordFor,
  resolveSet,
  type ReadingDeps,
} from '../reading';
import { knownTokens } from '@/lib/knownSentence';
import { learnedEntries } from '@/lib/sentenceCards';

const TODAY = '2026-10-12';
const TENSES: ReadonlySet<ResolvedTense> = new Set<ResolvedTense>(['presente']);

const item = (id: string, es: string, en: string, pos: PcicItem['pos'], exampleEs: string, exampleEn: string): PcicItem => ({
  id, es, en, kind: 'word', section: '', order: 0, pos, exampleEs, exampleEn,
});

// Every sentence is "article noun ser adjective": a learner who knows the nouns, the adjectives and ser knows it.
const ITEMS: PcicItem[] = [
  item('o1', 'la casa', 'house', 'noun', 'La casa es grande.', 'The house is big.'),
  item('o2', 'el perro', 'dog', 'noun', 'El perro es pequeño.', 'The dog is small.'),
  item('o3', 'el gato', 'cat', 'noun', 'El gato es nuevo.', 'The cat is new.'),
  item('o4', 'el libro', 'book', 'noun', 'El libro es grande.', 'The book is big.'),
  item('o5', 'la mesa', 'table', 'noun', 'La mesa es nueva.', 'The table is new.'),
  item('o6', 'el coche', 'car', 'noun', 'El coche es pequeño.', 'The car is small.'),
  item('o7', 'la flor', 'flower', 'noun', 'La flor es roja.', 'The flower is red.'), // "roja" is never learned
  item('o11', 'grande', 'big', 'adj', 'El perro es grande.', 'The dog is big.'),
  item('o12', 'pequeño', 'small', 'adj', 'La casa es pequeña.', 'The house is small.'),
  item('o13', 'nuevo', 'new', 'adj', 'El coche es nuevo.', 'The car is new.'),
  item('o14', 'ser', 'to be', 'verb', 'La casa es nueva.', 'The house is new.'),
];
const INFO: Record<string, GapSourceInfo> = {
  o1: { lemma: 'casa', sentenceLemmas: ['el', 'casa', 'ser', 'grande'] },
  o2: { lemma: 'perro', sentenceLemmas: ['el', 'perro', 'ser', 'pequeño'] },
  o3: { lemma: 'gato', sentenceLemmas: ['el', 'gato', 'ser', 'nuevo'] },
  o4: { lemma: 'libro', sentenceLemmas: ['el', 'libro', 'ser', 'grande'] },
  o5: { lemma: 'mesa', sentenceLemmas: ['el', 'mesa', 'ser', 'nuevo'] },
  o6: { lemma: 'coche', sentenceLemmas: ['el', 'coche', 'ser', 'pequeño'] },
  o7: { lemma: 'flor', sentenceLemmas: ['el', 'flor', 'ser', 'rojo'] },
  o11: { lemma: 'grande', sentenceLemmas: ['el', 'perro', 'ser', 'grande'] },
  o12: { lemma: 'pequeño', sentenceLemmas: ['el', 'casa', 'ser', 'pequeño'] },
  o13: { lemma: 'nuevo', sentenceLemmas: ['el', 'coche', 'ser', 'nuevo'] },
  o14: { lemma: 'ser', sentenceLemmas: ['el', 'casa', 'ser', 'nuevo'] },
};
const findItem = (id: string) => ITEMS.find((i) => i.id === id);
const info = (id: string) => INFO[id];

const learned = (itemId: string, due: string, over: Partial<Sm2Card> = {}): Sm2Card => ({
  ...sm2NewCard(itemId),
  state: 'review',
  interval: 4,
  reps: 2,
  due,
  lastReview: '2000-01-01',
  introducedAt: '2000-01-01',
  ...over,
});
// all eleven words are learned; the first six are due, oldest first (o1 the longest overdue)
const CARDS: Sm2Card[] = ITEMS.map((it, n) => learned(it.id, n < 6 ? `2026-10-0${n + 1}` : '2027-01-01'));

const deps = (over: Partial<ReadingDeps> = {}): ReadingDeps => ({
  target: 'es',
  cards: CARDS,
  tenses: TENSES,
  findItem,
  today: TODAY,
  info,
  ...over,
});
const known = (d: ReadingDeps) => knownTokens(d.target, { learned: learnedEntries(d.cards, d.target, d.findItem), tenses: d.tenses });

// a small deterministic [0, 1) source
const seeded = (seed: number) => {
  let x = seed;
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
};

describe('pickReadingWords', () => {
  it('the due words, the longest overdue first; a word with an unknown-word sentence is skipped and the next comes', () => {
    // o7 (flor) is due but "roja" is unknown to the learner; five of the six due words are usable
    const cards = [...CARDS.filter((c) => c.itemId !== 'o7'), learned('o7', '2026-09-01')];
    const words = pickReadingWords(deps({ cards }), known(deps({ cards })));
    expect(words.map((w) => w.itemId)).toEqual(['o1', 'o2', 'o3', 'o4', 'o5']);
  });

  it('too few due words: the freshly learned ones fill up (newest first); a word marked known by hand and an old not-due word stay out', () => {
    const cards = [
      learned('o1', '2026-10-01'), // due
      learned('o2', '2026-10-02'), // due
      learned('o11', '2027-01-01', { introducedAt: '2026-10-10' }), // learned 2 days ago
      learned('o12', '2027-01-01', { introducedAt: '2026-10-11' }), // learned yesterday
      learned('o13', '2027-01-01', { introducedAt: '2026-09-01' }), // old, not due
      learned('o3', '2026-10-01', { known: true }), // known by hand
      learned('o14', '2027-01-01', { introducedAt: '2026-10-09' }),
    ];
    const words = pickReadingWords(deps({ cards }), known(deps({ cards })));
    expect(words.map((w) => w.itemId)).toEqual(['o1', 'o2', 'o12', 'o11', 'o14']);
  });

  it('the highlighted word is the one as written in its own sentence', () => {
    const [first] = pickReadingWords(deps(), known(deps()));
    expect(first).toMatchObject({ itemId: 'o1', before: 'La ', answer: 'casa', after: ' es grande.', sentence: 'La casa es grande.', translation: 'The house is big.', meaning: 'house' });
  });

  it('at most five, and a new word is left out', () => {
    const many = [...CARDS, learned('o3', '2026-10-01', { state: 'new' })];
    expect(pickReadingWords(deps({ cards: many }), known(deps({ cards: many })))).toHaveLength(READING_WORDS);
    const onlyNew = [{ ...sm2NewCard('o1') }];
    expect(pickReadingWords(deps({ cards: onlyNew }), known(deps({ cards: onlyNew })))).toEqual([]);
  });

  it('the same sentence under two words counts once', () => {
    const twin = item('o20', 'la casa', 'house', 'noun', 'La casa es grande.', 'The house is big.');
    const items = [...ITEMS, twin];
    const d = deps({ cards: [learned('o1', '2026-10-01'), learned('o20', '2026-10-02'), ...CARDS.slice(1)], findItem: (id) => items.find((i) => i.id === id), info: (id) => (id === 'o20' ? INFO.o1 : INFO[id]) });
    const words = pickReadingWords(d, known(d));
    expect(words.map((w) => w.itemId)).not.toContain('o20');
  });
});

describe('buildReadingSet', () => {
  it('fewer than 3 usable sentences: no reading (the empty state)', () => {
    const two = [learned('o1', '2026-10-01'), learned('o2', '2026-10-02'), learned('o11', '2027-01-01'), learned('o14', '2027-01-01')];
    // o1 and o2 are due; o11/o14 are neither due nor fresh
    expect(buildReadingSet(deps({ cards: two }))).toBeNull();
    expect(buildReadingSet(deps({ cards: [] }))).toBeNull();
  });

  it('a word the learner has not learned makes no sentence (the gate): the nouns alone do not know "es"', () => {
    const noVerb = CARDS.filter((c) => c.itemId !== 'o14');
    // without ser the sentences contain an unknown word, so none passes
    expect(buildReadingSet(deps({ cards: noVerb }))).toBeNull();
  });

  it('five words, five questions, all resolved', () => {
    const set = buildReadingSet(deps({ random: seeded(1) }))!;
    expect(set.words).toHaveLength(5);
    expect(set.questions).toHaveLength(5);
    expect(set.resolved).toHaveLength(5);
  });
});

describe('buildQuestions', () => {
  const run = (seed: number, over: Partial<ReadingDeps> = {}) => {
    const d = deps({ random: seeded(seed), ...over });
    const k = known(d);
    const words = pickReadingWords(d, k);
    const questions = buildQuestions(words, d, k);
    return { words, questions, set: resolveSet(words, questions, d.findItem, d.target)! };
  };

  it('the same seed gives the same questions', () => {
    expect(run(7).questions).toEqual(run(7).questions);
  });

  it('meaning: the right meaning is among 3 different options, the others are other known words', () => {
    let meanings = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const { words, questions, set } = run(seed);
      questions.forEach((q, i) => {
        if (q.kind !== 'meaning') return;
        meanings++;
        const resolved = set.resolved[i];
        if (resolved.kind !== 'meaning') throw new Error('kind');
        const word = words.find((w) => w.itemId === q.itemId)!;
        expect(q.options).toHaveLength(3);
        expect(new Set(q.options).size).toBe(3);
        expect(resolved.options[resolved.correct]).toBe(word.meaning);
        expect(new Set(resolved.options.map((o) => o.toLowerCase())).size).toBe(3);
        expect(resolved.word).toBe(word.answer);
      });
    }
    expect(meanings).toBeGreaterThan(0);
  });

  it('meaning: the other options keep the part of speech where they can (nouns get nouns)', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const { words, questions } = run(seed);
      for (const q of questions) {
        if (q.kind !== 'meaning') continue;
        const own = findItem(q.itemId)!;
        // 6 nouns in the corpus, and the other words of the text are the last choice
        if (own.pos !== 'noun') continue;
        const others = q.options.filter((id) => id !== q.itemId);
        expect(others.every((id) => findItem(id)!.pos === 'noun')).toBe(true);
        expect(words.some((w) => w.itemId === q.itemId)).toBe(true);
      }
    }
  });

  it('true/false: one true and one false statement among five, the false one is not a sentence of the text', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const { words, questions, set } = run(seed);
      const tf = set.resolved.filter((r) => r.kind === 'truefalse');
      expect(tf).toHaveLength(2);
      expect(tf.filter((r) => r.truth)).toHaveLength(1);
      const translations = words.map((w) => w.translation);
      for (const r of tf) {
        if (r.kind !== 'truefalse') continue;
        expect(r.correct).toBe(r.truth ? 0 : 1);
        expect(translations.includes(r.statement)).toBe(r.truth);
      }
      // every false statement is the sentence of a known word that is not in the text
      for (const q of questions) {
        if (q.kind === 'truefalse' && !words.some((w) => w.itemId === q.sourceId)) {
          expect(findItem(q.sourceId)).toBeDefined();
        }
      }
    }
  });

  it('a false statement is only a sentence the learner knows: the unknown-word sentence never comes', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const { questions } = run(seed);
      expect(questions.some((q) => q.kind === 'truefalse' && q.sourceId === 'o7')).toBe(false);
    }
  });

  it('no other known sentence to lie with: the statement falls back to a true one', () => {
    // four usable sentences, and the two other learned words (o3, o14) have an unknown word in theirs
    const cards = CARDS.filter((c) => ['o1', 'o2', 'o3', 'o11', 'o12', 'o14'].includes(c.itemId)).map((c) => (['o3', 'o14'].includes(c.itemId) ? { ...c, due: '2027-01-01' } : { ...c, due: '2026-10-01' }));
    const d = deps({ cards, random: seeded(3) });
    const words = pickReadingWords(d, known(d));
    expect(words.map((w) => w.itemId).sort()).toEqual(['o1', 'o11', 'o12', 'o2']);
    const questions = buildQuestions(words, d, known(d));
    const statements = questions.filter((q) => q.kind === 'truefalse');
    expect(statements).toHaveLength(2);
    expect(statements.every((q) => q.kind === 'truefalse' && words.some((w) => w.itemId === q.sourceId))).toBe(true);
  });

  it('English target: the sentence is English, the meaning options are Spanish', () => {
    const en: PcicItem[] = [
      item('e1', 'la casa', 'house', 'noun', 'La casa es grande.', 'The house is big.'),
      item('e2', 'el perro', 'dog', 'noun', 'El perro es pequeño.', 'The dog is small.'),
      item('e3', 'el gato', 'cat', 'noun', 'El gato es grande.', 'The cat is big.'),
      item('e4', 'ser', 'to be', 'verb', 'Ser es bueno.', 'To be is good.'),
      item('e5', 'grande', 'big', 'adj', 'x', 'The big dog.'),
      item('e6', 'pequeño', 'small', 'adj', 'x', 'The small cat.'),
    ];
    const cards = en.map((it, n) => learned(it.id, n < 3 ? `2026-10-0${n + 1}` : '2027-01-01'));
    const d: ReadingDeps = { target: 'en', cards, findItem: (id) => en.find((i) => i.id === id), today: TODAY, random: seeded(2) };
    const set = buildReadingSet(d);
    // the sentences "The house is big" etc. use "is": the learner knows "to be"
    expect(set).not.toBeNull();
    expect(set!.words[0]).toMatchObject({ itemId: 'e1', answer: 'house', sentence: 'The house is big.', meaning: 'la casa' });
    const meaning = set!.resolved.find((r) => r.kind === 'meaning');
    if (meaning?.kind === 'meaning') expect(meaning.options[meaning.correct]).toMatch(/^(la casa|el perro|el gato)$/);
  });
});

describe('readingWordFor', () => {
  it('null when the word has no example sentence', () => {
    expect(readingWordFor(item('x', 'tener', 'to have', 'verb', '', ''), 'es', info)).toBeNull();
  });
});

describe('the real words-open data', () => {
  beforeAll(() => setPcicTarget('es'));

  it('a real word yields its sentence with the word as written in it', () => {
    expect(readingWordFor(findPcicItem('o33')!, 'es')).toMatchObject({ before: '', answer: 'Voy', sentence: 'Voy con ella.' });
  });
});
