import type { PcicItem } from '@/data/pcic';
import { knownTokens, type ResolvedTense } from '@/lib/knownSentence';
import { learnedEntries } from '@/lib/sentenceCards';
import { sm2NewCard, type Sm2Card } from '@/lib/sm2';
import type { ReadingDeps } from '../reading';
import { pickStory, storyWords, type Story } from '../stories';

const TODAY = '2026-10-23';
const TENSES: ReadonlySet<ResolvedTense> = new Set<ResolvedTense>(['presente']);

const item = (id: string, es: string, en: string, pos: PcicItem['pos']): PcicItem => ({ id, es, en, kind: 'word', section: '', order: 0, pos });
const ITEMS: PcicItem[] = [
  item('o1', 'la casa', 'house', 'noun'),
  item('o2', 'el perro', 'dog', 'noun'),
  item('o3', 'el gato', 'cat', 'noun'),
  item('o4', 'el libro', 'book', 'noun'),
  item('o5', 'la mesa', 'table', 'noun'),
  item('o6', 'grande', 'big', 'adj'),
  item('o7', 'pequeño', 'small', 'adj'),
  item('o8', 'ser', 'to be', 'verb'),
  item('o9', 'el coche', 'car', 'noun'),
  item('o10', 'la flor', 'flower', 'noun'),
];
const findItem = (id: string) => ITEMS.find((i) => i.id === id);

const sentence = (es: string, en: string, word: string, form: string) => ({ es, en, word, form });
const story = (id: string, sentences: ReturnType<typeof sentence>[]): Story => ({ id, level: 'A1', sentences, false_en: ['x', 'y'] });

// A: casa, perro, gato, libro, mesa. B: grande, pequeño, ser, libro, mesa. C: a sentence with the unknown word "roja".
const A = story('a', [
  sentence('La casa es grande.', 'The house is big.', 'o1', 'casa'),
  sentence('El perro es pequeño.', 'The dog is small.', 'o2', 'perro'),
  sentence('El gato es grande.', 'The cat is big.', 'o3', 'gato'),
  sentence('El libro es pequeño.', 'The book is small.', 'o4', 'libro'),
  sentence('La mesa es grande.', 'The table is big.', 'o5', 'mesa'),
]);
const B = story('b', [
  sentence('La casa es grande.', 'The house is big.', 'o6', 'grande'),
  sentence('El perro es pequeño.', 'The dog is small.', 'o7', 'pequeño'),
  sentence('El gato es pequeño.', 'The cat is small.', 'o8', 'es'),
  sentence('El libro es grande.', 'The book is big.', 'o4', 'libro'),
  sentence('La mesa es pequeña.', 'The table is small.', 'o5', 'mesa'),
]);
const C = story('c', [
  sentence('La flor es roja.', 'The flower is red.', 'o10', 'flor'),
  sentence('El perro es pequeño.', 'The dog is small.', 'o2', 'perro'),
  sentence('El gato es grande.', 'The cat is big.', 'o3', 'gato'),
  sentence('El libro es pequeño.', 'The book is small.', 'o4', 'libro'),
  sentence('La mesa es grande.', 'The table is big.', 'o5', 'mesa'),
]);

// a learned card: due on `due` ('2099-01-01' = not due, introduced long ago so it is not "fresh" either)
const learned = (itemId: string, due = '2099-01-01', over: Partial<Sm2Card> = {}): Sm2Card => ({
  ...sm2NewCard(itemId), state: 'review', interval: 4, reps: 2, due, lastReview: '2000-01-01', introducedAt: '2000-01-01', ...over,
});
const dueNow = '2026-10-01';
// every word of the fixture learned; `due` lists the ids that are due
const deckOf = (due: string[]): Sm2Card[] => ITEMS.map((it) => learned(it.id, due.includes(it.id) ? dueNow : undefined));

const deps = (cards: Sm2Card[], over: Partial<ReadingDeps> = {}): ReadingDeps => ({ target: 'es', cards, tenses: TENSES, findItem, today: TODAY, ...over });
const knownOf = (d: ReadingDeps) => knownTokens(d.target, { learned: learnedEntries(d.cards, d.target, d.findItem), tenses: d.tenses });
const pick = (d: ReadingDeps, stories: Story[]) => pickStory(d, knownOf(d), stories)?.story.id ?? null;

describe('storyWords', () => {
  it('one reading word per sentence: the form as written, the sentence, its translation and the card meaning', () => {
    const words = storyWords(A, findItem)!;
    expect(words).toHaveLength(5);
    expect(words[0]).toEqual({
      itemId: 'o1', before: 'La ', answer: 'casa', after: ' es grande.', translation: 'The house is big.', meaning: 'house', sentence: 'La casa es grande.',
    });
    expect(words.map((w) => w.itemId)).toEqual(['o1', 'o2', 'o3', 'o4', 'o5']);
  });

  it('the form is found whatever its case, and written as in the sentence', () => {
    const s = story('s', [sentence('Casa grande.', 'Big house.', 'o1', 'casa'), ...A.sentences.slice(1)]);
    expect(storyWords(s, findItem)![0]).toMatchObject({ before: '', answer: 'Casa', after: ' grande.' });
  });

  it('a form that is not a whole word of the sentence, or a card that is gone: null', () => {
    const bad = (i: number, over: Partial<ReturnType<typeof sentence>>) => story('s', A.sentences.map((s, n) => (n === i ? { ...s, ...over } : s)));
    expect(storyWords(bad(1, { form: 'perr' }), findItem)).toBeNull(); // part of a word
    expect(storyWords(bad(1, { form: 'gato' }), findItem)).toBeNull(); // not in this sentence
    expect(storyWords(bad(2, { form: 'el gato' }), findItem)).toBeNull(); // two words
    expect(storyWords(bad(3, { word: 'o999' }), findItem)).toBeNull();
  });
});

describe('pickStory', () => {
  it('the story with the most due words wins, also when it comes later in the data', () => {
    // B's words o6, o7, o8, o4, o5 are due (5), A's o1, o2, o3 are not (2: o4, o5)
    const d = deps(deckOf(['o4', 'o5', 'o6', 'o7', 'o8']));
    expect(pick(d, [A, B])).toBe('b');
    expect(pick(d, [B, A])).toBe('b');
    // the other way round
    expect(pick(deps(deckOf(['o1', 'o2', 'o3'])), [B, A])).toBe('a');
  });

  it('a tie: the data order', () => {
    const d = deps(deckOf(['o4', 'o5']));
    expect(pick(d, [A, B])).toBe('a');
    expect(pick(d, [B, A])).toBe('b');
  });

  it('the picked story comes with its reading words', () => {
    const d = deps(deckOf(['o1']));
    const picked = pickStory(d, knownOf(d), [A, B])!;
    expect(picked.story).toBe(A);
    expect(picked.words).toEqual(storyWords(A, findItem));
  });

  it('a fresh word counts as due (the same candidates as the old text)', () => {
    // B: nothing due; A: o1 learned yesterday = fresh
    const cards = deckOf([]).map((c) => (c.itemId === 'o1' ? { ...c, introducedAt: '2026-10-22' } : c));
    expect(pick(deps(cards), [B, A])).toBe('a');
  });

  it('a story with an unknown word is left out, even when it has the most due words', () => {
    const d = deps(deckOf(['o10', 'o2', 'o3', 'o4', 'o5']));
    // "roja" is not learned
    expect(pick(d, [C, A])).toBe('a');
    expect(pick(d, [C])).toBeNull();
  });

  it('a story whose word card is not learned is left out', () => {
    // every token of A is known through other cards, but the card of its first sentence (o9) is new
    const odd = story('odd', [sentence('La casa es grande.', 'The house is big.', 'o9', 'casa'), ...A.sentences.slice(1)]);
    const cards = deckOf(['o9']).map((c) => (c.itemId === 'o9' ? { ...sm2NewCard('o9') } : c));
    expect(pick(deps(cards), [odd])).toBeNull();
    expect(pick(deps(cards), [odd, B])).toBe('b');
    // a card that is not in the deck at all
    expect(pick(deps(cards.filter((c) => c.itemId !== 'o9')), [odd])).toBeNull();
    // learned: it is usable
    expect(pick(deps(deckOf(['o9'])), [odd])).toBe('odd');
  });

  it('a card marked known by hand is learned for the story, but never due', () => {
    const cards = deckOf([]).map((c) => (c.itemId === 'o9' ? { ...sm2NewCard('o9'), known: true } : c));
    const odd = story('odd', [sentence('La casa es grande.', 'The house is big.', 'o9', 'casa'), ...A.sentences.slice(1)]);
    expect(pick(deps(cards), [odd])).toBe('odd');
  });

  it('a story whose form is not in its sentence is left out', () => {
    const broken = story('broken', A.sentences.map((s, n) => (n === 0 ? { ...s, form: 'zzz' } : s)));
    expect(pick(deps(deckOf(['o1'])), [broken, B])).toBe('b');
  });

  it('the previous round story goes last, but stays when it is the only one', () => {
    const d = deps(deckOf(['o1', 'o2', 'o3', 'o4', 'o5']), { avoidStory: 'a' });
    expect(pick(d, [A, B])).toBe('b');
    expect(pick(d, [A])).toBe('a');
    // an unrelated id changes nothing
    expect(pick({ ...d, avoidStory: 'zzz' }, [A, B])).toBe('a');
  });

  it('the English direction has no stories', () => {
    const d = deps(deckOf(['o1', 'o2', 'o3', 'o4', 'o5']), { target: 'en' });
    expect(pickStory(d, new Set(['la', 'casa', 'es', 'grande']), [A, B])).toBeNull();
  });

  it('nothing learned: no story', () => {
    expect(pick(deps([]), [A, B])).toBeNull();
  });
});
