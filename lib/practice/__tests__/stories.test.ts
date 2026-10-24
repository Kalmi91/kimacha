import { findPcicItem, pcicItemsForLevel, setPcicTarget, type PcicItem, type PcicTarget } from '@/data/pcic';
import { knownTokens, type ResolvedTense } from '@/lib/knownSentence';
import { setActiveSource, type Lang } from '@/lib/languagePair';
import { learnedEntries } from '@/lib/sentenceCards';
import { sm2NewCard, type Sm2Card } from '@/lib/sm2';
import { buildQuestions, buildReadingSet, resolveSet, type ReadingDeps } from '../reading';
import { falseIn, pickStory, storiesFor, storyWords, type Story, type StorySentence } from '../stories';

const TODAY = '2026-10-23';
const TENSES: ReadonlySet<ResolvedTense> = new Set<ResolvedTense>(['presente']);

const item = (id: string, es: string, en: string, pos: PcicItem['pos'], hu?: string): PcicItem => ({ id, es, en, hu, kind: 'word', section: '', order: 0, pos });
const ITEMS: PcicItem[] = [
  item('o1', 'la casa', 'house', 'noun', 'ház'),
  item('o2', 'el perro', 'dog', 'noun', 'kutya'),
  item('o3', 'el gato', 'cat', 'noun', 'macska'),
  item('o4', 'el libro', 'book', 'noun', 'könyv'),
  item('o5', 'la mesa', 'table', 'noun', 'asztal'),
  item('o6', 'grande', 'big', 'adj', 'nagy'),
  item('o7', 'pequeño', 'small', 'adj', 'kicsi'),
  item('o8', 'ser', 'to be', 'verb', 'lenni'),
  item('o9', 'el coche', 'car', 'noun'),
  item('o10', 'la flor', 'flower', 'noun'),
];
const findItem = (id: string) => ITEMS.find((i) => i.id === id);

const sentence = (es: string, en: string, word: string, form: string): StorySentence => ({ es, en, word, form });
const story = (id: string, sentences: StorySentence[]): Story => ({ id, level: 'A1', sentences, false_en: ['x', 'y'] });

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

  it('a story with no text in the target language (here Hungarian) is left out', () => {
    const d = deps(deckOf(['o1', 'o2', 'o3', 'o4', 'o5']), { target: 'hu' });
    expect(pickStory(d, new Set(['a', 'ház', 'nagy', 'lenni']), [A, B])).toBeNull();
  });

  it('nothing learned: no story', () => {
    expect(pick(deps([]), [A, B])).toBeNull();
  });
});

// The pairs other than en→es (FB526 for every pair): the text is the target-language field, the translation and the
// true/false statements are the field of the learner's language (the active source, lib/languagePair.ts).
const tr = (texts: Partial<Record<Lang, string>>, word: string, form: string): StorySentence => ({ ...texts, word, form });

// target es, translations in three languages (a hu→es learner reads the Hungarian ones)
const AH: Story = {
  id: 'ah',
  level: 'A1',
  sentences: [
    tr({ es: 'La casa es grande.', en: 'The house is big.', hu: 'A ház nagy.' }, 'o1', 'casa'),
    tr({ es: 'El perro es pequeño.', en: 'The dog is small.', hu: 'A kutya kicsi.' }, 'o2', 'perro'),
    tr({ es: 'El gato es grande.', en: 'The cat is big.', hu: 'A macska nagy.' }, 'o3', 'gato'),
    tr({ es: 'El libro es pequeño.', en: 'The book is small.', hu: 'A könyv kicsi.' }, 'o4', 'libro'),
    tr({ es: 'La mesa es grande.', en: 'The table is big.', hu: 'Az asztal nagy.' }, 'o5', 'mesa'),
  ],
  false_en: ['The house is small.', 'The dog is big.'],
  false_hu: ['A ház kicsi.', 'A kutya nagy.'],
};
// target hu (an es→hu or en→hu learner), target en (an es→en or hu→en learner)
const HU_T: Story = {
  id: 'hu-t',
  level: 'A1',
  sentences: [
    tr({ hu: 'A ház nagy.', es: 'La casa es grande.', en: 'The house is big.' }, 'o1', 'ház'),
    tr({ hu: 'A kutya kicsi.', es: 'El perro es pequeño.', en: 'The dog is small.' }, 'o2', 'kutya'),
    tr({ hu: 'A macska nagy.', es: 'El gato es grande.', en: 'The cat is big.' }, 'o3', 'macska'),
    tr({ hu: 'A könyv kicsi.', es: 'El libro es pequeño.', en: 'The book is small.' }, 'o4', 'könyv'),
    tr({ hu: 'Az asztal nagy.', es: 'La mesa es grande.', en: 'The table is big.' }, 'o5', 'asztal'),
  ],
  false_es: ['La casa es pequeña.', 'El perro es grande.'],
  false_en: ['The house is small.', 'The dog is big.'],
};
const EN_T: Story = {
  id: 'en-t',
  level: 'A1',
  sentences: [
    tr({ en: 'The house is big.', es: 'La casa es grande.', hu: 'A ház nagy.' }, 'o1', 'house'),
    tr({ en: 'The dog is small.', es: 'El perro es pequeño.', hu: 'A kutya kicsi.' }, 'o2', 'dog'),
    tr({ en: 'The cat is big.', es: 'El gato es grande.', hu: 'A macska nagy.' }, 'o3', 'cat'),
    tr({ en: 'The book is small.', es: 'El libro es pequeño.', hu: 'A könyv kicsi.' }, 'o4', 'book'),
    tr({ en: 'The table is big.', es: 'La mesa es grande.', hu: 'Az asztal nagy.' }, 'o5', 'table'),
  ],
  false_es: ['La casa es pequeña.', 'El perro es grande.'],
  false_hu: ['A ház kicsi.', 'A kutya nagy.'],
};

describe('a story in the language of each pair', () => {
  afterEach(() => setActiveSource(null));

  const all = deckOf([]);
  const pickIn = (target: PcicTarget, source: Lang, s: Story) => {
    setActiveSource(source);
    const d = deps(all, { target });
    return pickStory(d, knownOf(d), [s]);
  };
  const statementsOf = (target: PcicTarget, s: Story) => {
    const d = deps(all, { target, random: () => 0.5 });
    const words = storyWords(s, findItem, target)!;
    const qs = buildQuestions(words, d, knownOf(d), s);
    return resolveSet(words, qs, findItem, target, s)!.resolved.filter((r) => r.kind === 'truefalse');
  };

  it('hu→es: the Hungarian translations, meanings and false statements', () => {
    setActiveSource('hu');
    const words = storyWords(AH, findItem)!;
    expect(words[0]).toEqual({
      itemId: 'o1', before: 'La ', answer: 'casa', after: ' es grande.', translation: 'A ház nagy.', meaning: 'ház', sentence: 'La casa es grande.',
    });
    expect(words.map((w) => w.translation)).toEqual(AH.sentences.map((s) => s.hu));
    const statements = statementsOf('es', AH);
    expect(statements.map((r) => r.truth).sort()).toEqual([false, true]);
    expect(AH.false_hu).toContain((statements.find((r) => !r.truth) as { statement: string }).statement);
    expect(AH.sentences.map((s) => s.hu)).toContain((statements.find((r) => r.truth) as { statement: string }).statement);
  });

  it('en→es keeps the English ones, with the same story', () => {
    setActiveSource('en');
    expect(storyWords(AH, findItem)!.map((w) => w.translation)).toEqual(AH.sentences.map((s) => s.en));
    const wrong = statementsOf('es', AH).find((r) => !r.truth) as { statement: string };
    expect(AH.false_en).toContain(wrong.statement);
  });

  it('a story without the translation of the learner language is left out (hu→es with only es and en texts)', () => {
    expect(pickIn('es', 'hu', A)).toBeNull();
    expect(storyWords(A, findItem)).toBeNull();
    expect(falseIn(A, 'hu')).toEqual([]);
    // the same story is read by an English-speaking learner
    setActiveSource('en');
    expect(storyWords(A, findItem)!).toHaveLength(5);
  });

  it.each<[Lang]>([['es'], ['en']])('%s→hu: a Hungarian story with the translation of the learner language', (source) => {
    const picked = pickIn('hu', source, HU_T)!;
    expect(picked.story).toBe(HU_T);
    expect(picked.words.map((w) => w.sentence)).toEqual(HU_T.sentences.map((s) => s.hu));
    expect(picked.words.map((w) => w.translation)).toEqual(HU_T.sentences.map((s) => s[source]));
    expect(picked.words[0]).toMatchObject({ before: 'A ', answer: 'ház', after: ' nagy.' });
    // the meaning of the card is in the learner language
    expect(picked.words[0].meaning).toBe(source === 'es' ? 'la casa' : 'house');
    setActiveSource(source);
    const wrong = statementsOf('hu', HU_T).find((r) => !r.truth) as { statement: string };
    expect(falseIn(HU_T, source)).toContain(wrong.statement);
  });

  it.each<[Lang]>([['es'], ['hu']])('%s→en: an English story with the translation of the learner language', (source) => {
    const picked = pickIn('en', source, EN_T)!;
    expect(picked.story).toBe(EN_T);
    expect(picked.words.map((w) => w.sentence)).toEqual(EN_T.sentences.map((s) => s.en));
    expect(picked.words.map((w) => w.translation)).toEqual(EN_T.sentences.map((s) => s[source]));
    expect(picked.words[1]).toMatchObject({ before: 'The ', answer: 'dog', after: ' is small.' });
    setActiveSource(source);
    const wrong = statementsOf('en', EN_T).find((r) => !r.truth) as { statement: string };
    expect(falseIn(EN_T, source)).toContain(wrong.statement);
  });

  it('a Hungarian or English story is left out when its words are not all learned', () => {
    setActiveSource('es');
    const some = deps(deckOf([]).filter((c) => c.itemId !== 'o5'), { target: 'hu' });
    expect(pickStory(some, knownOf(some), [HU_T])).toBeNull();
    const english = deps(deckOf([]).filter((c) => c.itemId !== 'o5'), { target: 'en' });
    expect(pickStory(english, knownOf(english), [EN_T])).toBeNull();
  });
});

// The shipped files, whole pipeline: a learner who knows the whole A1 deck of each of the six pairs gets a story of the file of
// the target, written in the target language, translated and questioned in the language of the learner.
describe('the stories of the six pairs', () => {
  afterEach(() => setPcicTarget('es'));

  const PAIRS: [Lang, PcicTarget][] = [['en', 'es'], ['hu', 'es'], ['es', 'en'], ['hu', 'en'], ['es', 'hu'], ['en', 'hu']];
  it.each(PAIRS)('%s→%s', (source, target) => {
    setPcicTarget(target, source);
    const cards = pcicItemsForLevel('A1').map((i) => learned(i.id));
    const set = buildReadingSet({ target, cards, tenses: TENSES, findItem: findPcicItem, today: TODAY, random: () => 0.5 })!;
    const story = storiesFor(target).find((s) => s.id === set.storyId)!;
    expect(story).toBeDefined();
    expect(set.words.map((w) => w.sentence)).toEqual(story.sentences.map((s) => s[target]));
    const translations = story.sentences.map((s) => s[source]);
    expect(set.words.map((w) => w.translation)).toEqual(translations);
    const statements = set.resolved.filter((r) => r.kind === 'truefalse').map((r) => (r as { statement: string }).statement);
    expect(statements.length).toBeGreaterThan(0);
    for (const statement of statements) expect([...translations, ...falseIn(story, source)]).toContain(statement);
  });
});
