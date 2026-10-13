// Sentences tab queue: the learned-words gate, due words first, fewer words first, wrong goes to the end,
// and one half per learned word for a right sentence.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));

import type { PcicItem } from '@/data/pcic';
import { getDb } from '@/lib/database';
import { afterSentence, buildSentenceQueue, isDueCard, recordTypedWords, sentenceKey } from '@/lib/sentenceTab';
import type { WordVerdict } from '@/lib/sentenceTyping';
import { sm2NewCard, type Sm2Card } from '@/lib/sm2';
import { localDateString } from '@/lib/usageStats';

const TODAY = '2026-10-12';

const mk = (n: number, es: string, en: string, exampleEs?: string, exampleEn?: string, pos?: PcicItem['pos']): PcicItem => ({
  id: `a1-s${n}`, es, en, kind: 'word', section: 'Test', order: n, exampleEs, exampleEn, pos,
});

const ITEMS: PcicItem[] = [
  mk(1, 'el libro', 'the book', 'El libro y la mesa.', 'The book and the table.'),
  mk(2, 'la mesa', 'the table', 'La mesa y el libro azul.', 'The table and the blue book.'),
  mk(3, 'el gato', 'the cat', 'El gato.', 'The cat.'),
  mk(4, 'el perro', 'the dog', 'El perro y el gato y el libro.', 'The dog and the cat and the book.'),
  mk(5, 'la casa', 'the house', 'La casa y la mesa.', 'The house and the table.'),
  mk(6, 'azul', 'blue', undefined, undefined, 'adj'),
];
const byId = new Map(ITEMS.map((i) => [i.id, i]));
const findItem = (id: string) => byId.get(id);

// A learned review card (due `due`).
const learned = (item: PcicItem, due = '2026-10-20'): Sm2Card => ({
  ...sm2NewCard(item.id), state: 'review', interval: 3, reps: 2, due, lastReview: '2026-10-09', introducedAt: '2026-10-09',
});

const queue = (cards: Sm2Card[], extra: Partial<Parameters<typeof buildSentenceQueue>[0]> = {}) =>
  buildSentenceQueue({ target: 'es', cards, items: ITEMS, findItem, today: TODAY, ...extra });

describe('buildSentenceQueue', () => {
  it('a sentence with an unknown word is left out', () => {
    // libro + mesa learned: sentence 1 passes; sentence 2 has "azul" (not learned), so no.
    const q = queue([learned(ITEMS[0]), learned(ITEMS[1])]);
    expect(q.map((e) => e.itemId)).toEqual(['a1-s1']);
  });

  it('a new (never answered) card does not unlock its sentences', () => {
    const q = queue([learned(ITEMS[0]), sm2NewCard(ITEMS[1].id)]);
    expect(q).toEqual([]);
  });

  it('shorter sentences first among equals', () => {
    const q = queue(ITEMS.slice(0, 5).map((i) => learned(i)));
    // words: s3 = 2, s1 = 5, s5 = 5, s4 = 8 (s2 has the unlearned "azul")
    expect(q.map((e) => [e.itemId, e.wordCount])).toEqual([['a1-s3', 2], ['a1-s1', 5], ['a1-s5', 5], ['a1-s4', 8]]);
  });

  it('a sentence with a due word comes first, whatever its length', () => {
    const cards = ITEMS.slice(0, 5).map((i) => learned(i));
    cards[3] = learned(ITEMS[3], '2026-10-11'); // el perro is due
    const q = queue(cards);
    expect(q[0].itemId).toBe('a1-s4');
    expect(q[0].due).toBe(true);
    expect(q.slice(1).every((e) => !e.due || e.wordIds.includes('a1-s4'))).toBe(true);
    // the due word also pulls the other sentences that use it
    expect(q.filter((e) => e.due).map((e) => e.itemId)).toEqual(['a1-s4']);
  });

  it('more due words first, then fewer words; a sentence without a due word comes last', () => {
    const cards = ITEMS.slice(0, 5).map((i) => learned(i));
    cards[0] = learned(ITEMS[0], '2026-10-10'); // el libro due
    cards[1] = learned(ITEMS[1], '2026-10-10'); // la mesa due
    // s1 has both (2), s5 has mesa and s4 has libro (1 each, the shorter first), s3 has none
    expect(queue(cards).map((e) => [e.itemId, e.dueIds.length])).toEqual([['a1-s1', 2], ['a1-s5', 1], ['a1-s4', 1], ['a1-s3', 0]]);
  });

  it('a less fresh review comes before a fresher one with as many due words, even if it is longer', () => {
    const stale = { ...learned(ITEMS[4], '2026-10-10'), lastReview: '2026-09-01' }; // la casa (s5, 5 words)
    const fresh = { ...learned(ITEMS[2], '2026-10-10'), lastReview: '2026-10-09' }; // el gato (s3, 2 words)
    const q = queue([fresh, learned(ITEMS[1]), stale]);
    expect(q.map((e) => [e.itemId, e.staleness])).toEqual([['a1-s5', '2026-09-01'], ['a1-s3', '2026-10-09']]);
  });

  it('focus: the sentences with the most focus words come first, before the due ones', () => {
    const cards = ITEMS.slice(0, 5).map((i) => learned(i));
    cards[3] = learned(ITEMS[3], '2026-10-10'); // el perro is due: s4 leads without a focus
    expect(queue(cards)[0].itemId).toBe('a1-s4');
    const q = queue(cards, { focus: new Set(['a1-s5']) });
    expect(q[0].itemId).toBe('a1-s5');
    expect(queue(cards, { focus: new Set(['nope']) })[0].itemId).toBe('a1-s4');
  });

  it('dueIds and slots: the due learned words, and per learned word the words of the sentence it owns', () => {
    const cards = ITEMS.slice(0, 5).map((i) => learned(i));
    cards[3] = learned(ITEMS[3], '2026-10-10'); // el perro due
    const s4 = queue(cards).find((e) => e.itemId === 'a1-s4')!;
    expect(s4.dueIds).toEqual(['a1-s4']);
    expect([...s4.slots].sort((a, b) => a.id.localeCompare(b.id))).toEqual([
      { id: 'a1-s1', words: ['libro'] },
      { id: 'a1-s3', words: ['gato'] },
      { id: 'a1-s4', words: ['perro'] },
    ]);
  });

  it('wordIds: each learned word of the sentence once; free words (el, la, y) are nobody\'s', () => {
    const q = queue(ITEMS.slice(0, 5).map((i) => learned(i)));
    const s4 = q.find((e) => e.itemId === 'a1-s4')!;
    expect(s4.wordIds.sort()).toEqual(['a1-s1', 'a1-s3', 'a1-s4']); // libro, gato, perro (the card "el gato" owns only "gato")
  });

  it('the same sentence under two items counts once; finished sentences are left out', () => {
    const twin = { ...ITEMS[0], id: 'a1-s9' };
    const items = [...ITEMS, twin];
    const q = buildSentenceQueue({ target: 'es', cards: [learned(ITEMS[0]), learned(ITEMS[1])], items, findItem: (id) => (id === 'a1-s9' ? twin : byId.get(id)), today: TODAY });
    expect(q).toHaveLength(1);
    const q2 = queue([learned(ITEMS[0]), learned(ITEMS[1])], { done: new Set([sentenceKey(q[0])]) });
    expect(q2).toEqual([]);
  });

  it('a marked-known card counts as learned', () => {
    const known: Sm2Card = { ...sm2NewCard(ITEMS[2].id), known: true, state: 'review', interval: 60, due: '2026-12-01' };
    expect(queue([known]).map((e) => e.itemId)).toEqual(['a1-s3']);
  });
});

describe('isDueCard', () => {
  it('review/learning with due <= today; new and future are not', () => {
    expect(isDueCard(learned(ITEMS[0], TODAY), TODAY)).toBe(true);
    expect(isDueCard(learned(ITEMS[0], '2026-10-13'), TODAY)).toBe(false);
    expect(isDueCard(sm2NewCard('x'), TODAY)).toBe(false);
  });
});

describe('afterSentence', () => {
  const e = (id: string) => ({ itemId: id, source: '', target: id, wordCount: 1, wordIds: [], due: false, dueIds: [], staleness: '', slots: [] });
  it('right: the head is gone; wrong: the head goes to the end', () => {
    const q = [e('a'), e('b'), e('c')];
    expect(afterSentence(q, true).map((x) => x.itemId)).toEqual(['b', 'c']);
    expect(afterSentence(q, false).map((x) => x.itemId)).toEqual(['b', 'c', 'a']);
    expect(afterSentence([], false)).toEqual([]);
  });
});

describe('recordTypedWords', () => {
  const v = (id: string, right: boolean, due = false): WordVerdict => ({ id, right, due });

  beforeEach(async () => {
    await getDb().resetPcicCards();
  });

  it('one half per right word, once; a word without a card is skipped', async () => {
    const db = getDb();
    await db.upsertPcicCard(learned(ITEMS[0], TODAY));
    await db.upsertPcicCard(learned(ITEMS[1]));
    const n = await recordTypedWords([v('a1-s1', true), v('a1-s2', true), v('a1-nocard', true), v('a1-s1', true)], false, TODAY);
    expect(n).toEqual({ right: 2, wrong: 0 });
    const cards = new Map((await db.getPcicCards()).map((c) => [c.itemId, c]));
    expect(cards.get('a1-s1')?.halfSteps).toBe(1); // the repeated verdict did not count twice
    expect(cards.get('a1-s2')?.halfSteps).toBe(1);
    // a second typed sentence: 2 halves = one full step (the due date moves)
    await recordTypedWords([v('a1-s1', true)], false, TODAY);
    const again = (await db.getPcicCards()).find((c) => c.itemId === 'a1-s1')!;
    expect(again.halfSteps).toBe(0);
    expect(again.reps).toBe(3);
  });

  it('a wrong word counts as a wrong typed answer only when it is due; two in a row step the word back', async () => {
    const db = getDb();
    await db.upsertPcicCard(learned(ITEMS[0], '2026-10-10')); // due
    await db.upsertPcicCard(learned(ITEMS[1])); // not due
    const n = await recordTypedWords([v('a1-s1', false, true), v('a1-s2', false, false)], false, TODAY);
    expect(n).toEqual({ right: 0, wrong: 1 });
    let cards = new Map((await db.getPcicCards()).map((c) => [c.itemId, c]));
    expect(cards.get('a1-s1')?.wrongStreak).toBe(1);
    expect(cards.get('a1-s2')?.wrongStreak ?? 0).toBe(0);
    await recordTypedWords([v('a1-s1', false, true)], false, TODAY);
    cards = new Map((await db.getPcicCards()).map((c) => [c.itemId, c]));
    expect(cards.get('a1-s1')?.wrongStreak).toBe(0); // the second miss moved it back one step
    expect(cards.get('a1-s1')?.interval).toBeLessThan(3);
  });

  it('beta xpV2: off earns no XP; on, each right half earns XP by its own word reps (1, or 0.2 from the 3rd), a wrong word none', async () => {
    const db = getDb();
    const day = localDateString();
    await db.addDailyXpTenths(day, -100000);
    await db.upsertPcicCard(learned(ITEMS[0]));
    await db.upsertPcicCard({ ...learned(ITEMS[1]), reps: 3 });
    await db.upsertPcicCard(learned(ITEMS[2], '2026-10-10'));
    await recordTypedWords([v('a1-s1', true), v('a1-s2', true)], false, TODAY);
    expect(await db.getDailyXpTenths(day)).toBe(0);
    await recordTypedWords([v('a1-s1', true), v('a1-s2', true), v('a1-nocard', true), v('a1-s3', false, true)], true, TODAY);
    expect(await db.getDailyXpTenths(day)).toBe(10 + 2);
  });
});
