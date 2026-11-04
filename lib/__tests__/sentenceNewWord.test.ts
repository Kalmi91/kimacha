// New words on the Sentences tab (lib/sentenceNewWord.ts, FB564): the budget shared with the Learn tab, the picking (3 per
// round, never a sentence-kind item, a started card is not new), the entries (a word card, then its own sentence only when
// every other word of it is known), the introduction (the Learn tab's SM-2 review, once), and the steps / answer / saved
// round of an entry that starts with a word card. Every pair (es, en, hu, de).

import type { PcicItem, PcicKind, PcicTarget } from '@/data/pcic';
import { getDb } from '@/lib/database';
import { setActiveSource } from '@/lib/languagePair';
import {
  MAX_NEW_WORDS_PER_ROUND,
  introduceNewWord,
  newWordsLeft,
  nextNewWordIds,
  planNewWords,
} from '@/lib/sentenceNewWord';
import { unknownTokens } from '@/lib/knownSentence';
import type { LadderStage } from '@/lib/sentenceLadder';
import { answerStep, currentStep, dropEntries, parseSentenceRound, startRound, unpassedNewWords } from '@/lib/sentenceRound';
import { roundSteps } from '@/lib/sentenceSteps';
import { sentenceKey, type SentenceEntry } from '@/lib/sentenceTab';
import { pickSm2Session, sm2NewCard, type Sm2Card } from '@/lib/sm2';

const TODAY = '2026-11-03';

const item = (n: number, w: [string, string, string, string], ex: [string, string, string, string] | null, kind: PcicKind = 'word'): PcicItem => ({
  id: `a1-n${n}`, es: w[0], en: w[1], hu: w[2], de: w[3], kind, section: 'Test', order: n,
  ...(ex ? { exampleEs: ex[0], exampleEn: ex[1], exampleHu: ex[2], exampleDe: ex[3] } : {}),
});
// 1: a sentence made of the word alone. 2: its sentence needs word 1. 3: its sentence needs words nobody knows. 4: no sentence.
// 5: a sentence-kind item (no word card). 6, 7: more words, to fill a round.
const ITEMS: PcicItem[] = [
  item(1, ['libro', 'book', 'könyv', 'Buch'], ['Libro.', 'Book.', 'Könyv.', 'Buch.']),
  item(2, ['mesa', 'table', 'asztal', 'Tisch'], ['Libro y mesa.', 'Book and table.', 'Könyv és asztal.', 'Buch und Tisch.']),
  item(3, ['gato', 'cat', 'macska', 'Katze'], ['El perro come.', 'The dog eats.', 'A kutya eszik.', 'Der Hund isst.']),
  item(4, ['casa', 'house', 'ház', 'Haus'], null),
  item(5, ['Hola.', 'Hello.', 'Szia.', 'Hallo.'], ['Hola.', 'Hello.', 'Szia.', 'Hallo.'], 'sentence'),
  item(6, ['pan', 'bread', 'kenyér', 'Brot'], null),
  item(7, ['sol', 'sun', 'nap', 'Sonne'], null),
];
const byId = new Map(ITEMS.map((i) => [i.id, i]));
const findItem = (id: string) => byId.get(id);
const ORDER = ITEMS.map((i) => i.id);

const review = (id: string, introducedAt: string | null = '2026-10-09'): Sm2Card => ({
  ...sm2NewCard(id), state: 'review', interval: 3, reps: 2, due: '2099-01-01', lastReview: '2026-10-09', introducedAt,
});
const budget = (limit: number, bonus = 0) => ({ getDailyNewLimit: async () => limit, getPcicNewBonus: async () => bonus });

describe('newWordsLeft: the Learn tab\'s daily budget', () => {
  it('the limit plus the day\'s bonus, minus every card introduced today', () => {
    expect(newWordsLeft({ limit: 20, bonus: 0, introducedAllLevels: 0 })).toBe(20);
    expect(newWordsLeft({ limit: 20, bonus: 10, introducedAllLevels: 12 })).toBe(18);
    expect(newWordsLeft({ limit: 5, bonus: 0, introducedAllLevels: 5 })).toBe(0);
  });
  it('never negative (more introduced than the limit: the Learn tab\'s bonus can only go up)', () => {
    expect(newWordsLeft({ limit: 5, bonus: 0, introducedAllLevels: 9 })).toBe(0);
    expect(newWordsLeft({ limit: 0, bonus: 0, introducedAllLevels: 0 })).toBe(0);
  });
});

describe('nextNewWordIds', () => {
  const kindOf = (id: string) => findItem(id)?.kind;

  it('the next words in the given order, at most `count`', () => {
    expect(nextNewWordIds(ORDER, [], kindOf, 2)).toEqual(['a1-n1', 'a1-n2']);
    expect(nextNewWordIds(ORDER, [], kindOf, 0)).toEqual([]);
  });

  it('a started card (learning or review) is not a new word; a card still `new` is', () => {
    const learning: Sm2Card = { ...sm2NewCard('a1-n2'), state: 'learning' };
    expect(nextNewWordIds(ORDER, [review('a1-n1'), learning], kindOf, 3)).toEqual(['a1-n3', 'a1-n4', 'a1-n6']);
    expect(nextNewWordIds(ORDER, [sm2NewCard('a1-n1')], kindOf, 1)).toEqual(['a1-n1']);
  });

  it('a sentence-kind item is no word card', () => {
    expect(nextNewWordIds(ORDER, [], kindOf, 99)).not.toContain('a1-n5');
  });
});

describe.each(['es', 'en', 'hu', 'de'] as const)('planNewWords, target %s', (target: PcicTarget) => {
  beforeEach(() => setActiveSource(target === 'en' ? 'es' : 'en'));
  afterEach(() => setActiveSource(null));
  const plan = (over: Partial<Parameters<typeof planNewWords>[0]> = {}) =>
    planNewWords({ db: budget(20), target, today: TODAY, order: ORDER, cards: [], findItem, ...over });
  const text = (i: PcicItem) => (target === 'es' ? i.exampleEs : target === 'en' ? i.exampleEn : target === 'hu' ? i.exampleHu : i.exampleDe) ?? '';

  it('a beginner: the first word brings its own sentence, the next one a sentence with the first word in it, the third (unknown words) the card alone', async () => {
    const { entries, budgetOut } = await plan();
    expect(budgetOut).toBe(false);
    expect(entries.map((e) => e.itemId)).toEqual(['a1-n1', 'a1-n2', 'a1-n3']);
    expect(entries.every((e) => e.newWord === true)).toBe(true);
    expect(entries.map((e) => e.target)).toEqual([text(ITEMS[0]), text(ITEMS[1]), '']);
    expect(entries[2].source).toBe('');
    // the steps: the card, then its sentence on rung 1; the card alone where there is no sentence
    expect(roundSteps(entries, {}).map((s) => s.id)).toEqual(['a1-n1#newword', 'a1-n1#build', 'a1-n2#newword', 'a1-n2#build', 'a1-n3#newword']);
    expect(entries.every((e) => e.rung === undefined)).toBe(true);
  });

  it('the sentence rule: a sentence needing a word that is neither known nor taught before it is not carried (the word comes as the card alone)', async () => {
    const { entries } = await plan({ order: ['a1-n2', 'a1-n1'] }); // the word 2 comes BEFORE the word 1 it needs
    expect(entries.map((e) => e.target)).toEqual(['', text(ITEMS[0])]);
    // and no carried sentence has an unknown word once the words before it count as known
    const known = new Set<string>();
    for (const e of (await plan()).entries) {
      if (e.target) {
        const learnedBefore = [...known, e.itemId].map((id) => ({ text: String((findItem(id) as PcicItem)[target]), pos: undefined }));
        expect(unknownTokens(e.target, target, { learned: learnedBefore })).toEqual([]);
      }
      known.add(e.itemId);
    }
  });

  it('at most 3 new words in a round', async () => {
    expect(MAX_NEW_WORDS_PER_ROUND).toBe(3);
    const { entries } = await plan();
    expect(entries).toHaveLength(3);
    expect(entries.map((e) => e.itemId)).not.toContain('a1-n5');
  });

  it('the budget: what is left of today\'s limit caps the round; cards introduced today (any level) are used', async () => {
    expect((await plan({ db: budget(2) })).entries).toHaveLength(2);
    expect((await plan({ db: budget(5), cards: [review('x-1', TODAY), review('x-2', TODAY), review('x-3', TODAY), review('x-4', TODAY)] })).entries).toHaveLength(1);
    // a card introduced on another day does not use today's budget
    expect((await plan({ db: budget(1), cards: [review('x-1', '2026-11-02')] })).entries).toHaveLength(1);
    // the day's bonus (the Learn tab's "+10") adds to it
    expect((await plan({ db: budget(1, 2), cards: [review('x-1', TODAY)] })).entries).toHaveLength(2);
  });

  it('the budget used up: no entry, and the tab is told (the line says so); with no word left it is not the budget', async () => {
    expect(await plan({ db: budget(0) })).toEqual({ entries: [], budgetOut: true });
    expect(await plan({ db: budget(2), cards: [review('x-1', TODAY), review('x-2', TODAY)] })).toEqual({ entries: [], budgetOut: true });
    const all = ORDER.map((id) => review(id));
    expect(await plan({ db: budget(0), cards: all })).toEqual({ entries: [], budgetOut: false });
    expect(await plan({ db: budget(20), cards: all })).toEqual({ entries: [], budgetOut: false });
  });

  it('words already learned are not offered again; the next ones come, with the known words counting for the sentence', async () => {
    const { entries } = await plan({ cards: [review('a1-n1')] });
    expect(entries.map((e) => e.itemId)).toEqual(['a1-n2', 'a1-n3', 'a1-n4']);
    expect(entries[0].target).toBe(text(ITEMS[1])); // word 1 is known: the sentence "libro y mesa" is made of known words and the new one
    expect(entries.slice(1).map((e) => e.target)).toEqual(['', '']);
  });

  it('a sentence the ladder already has (rung 2, 3 or learned, from another item) is not played again here: the word is the card alone', async () => {
    const key = sentenceKey({ target: text(ITEMS[0]) });
    for (const stage of [2, 3, 'learned'] as LadderStage[]) {
      const { entries } = await plan({ ladder: new Map<string, LadderStage>([[key, stage]]) });
      expect(entries[0].target).toBe('');
    }
    expect((await plan({ ladder: new Map<string, LadderStage>([[key, 1]]) })).entries[0].target).toBe(text(ITEMS[0]));
  });
});

describe('introduceNewWord: the Learn tab\'s introduction', () => {
  beforeEach(async () => {
    await getDb().resetPcicCards();
  });

  it('writes a learned (review) card introduced today, like "Knew it" on a new card in the Learn tab', async () => {
    expect(await introduceNewWord(getDb(), 'a1-n1', TODAY)).toBe('introduced');
    const card = await getDb().getPcicCard('a1-n1');
    expect(card).toMatchObject({ itemId: 'a1-n1', state: 'review', introducedAt: TODAY, reps: 1, lastReview: TODAY });
  });

  it('once: a word whose card already started (this step before a restart, or the Learn tab) is left as it is', async () => {
    await introduceNewWord(getDb(), 'a1-n1', TODAY);
    const first = await getDb().getPcicCard('a1-n1');
    expect(await introduceNewWord(getDb(), 'a1-n1', TODAY)).toBe('started');
    expect(await getDb().getPcicCard('a1-n1')).toEqual(first);
    await getDb().upsertPcicCard({ ...review('a1-n2'), reps: 7 });
    expect(await introduceNewWord(getDb(), 'a1-n2', TODAY)).toBe('started');
    expect((await getDb().getPcicCard('a1-n2'))?.reps).toBe(7);
  });

  it('a card that exists as `new` is introduced', async () => {
    await getDb().upsertPcicCard(sm2NewCard('a1-n3'));
    expect(await introduceNewWord(getDb(), 'a1-n3', TODAY)).toBe('introduced');
    expect((await getDb().getPcicCard('a1-n3'))?.state).toBe('review');
  });

  it('shared with the Learn tab: the word is no longer new there, and it counts in today\'s budget there', async () => {
    const before = pickSm2Session(await getDb().getPcicCards(), ORDER, TODAY, 3).filter((c) => c.state === 'new').map((c) => c.itemId);
    expect(before).toEqual(['a1-n1', 'a1-n2', 'a1-n3']);
    await introduceNewWord(getDb(), 'a1-n1', TODAY);
    const cards = await getDb().getPcicCards();
    const after = pickSm2Session(cards, ORDER, TODAY, 3).filter((c) => c.state === 'new').map((c) => c.itemId);
    expect(after).toEqual(['a1-n2', 'a1-n3']); // budget 3, one introduced today: two new left
    expect(after).not.toContain('a1-n1');
    // and the tab itself plans one word fewer from the same budget
    const plan = await planNewWords({ db: budget(3), target: 'es', today: TODAY, order: ORDER, cards, findItem });
    expect(plan.entries.map((e) => e.itemId)).toEqual(['a1-n2', 'a1-n3']);
  });
});

describe('introduceNewWord: the budget is rechecked when the card is passed', () => {
  beforeEach(async () => {
    await getDb().resetPcicCards();
    await getDb().setDailyNewLimit(2);
    await getDb().setPcicNewBonus(0, TODAY);
  });
  afterEach(async () => {
    await getDb().setDailyNewLimit(10);
  });

  it('the day words used meanwhile (the Learn tab) leave no room: nothing is written', async () => {
    await getDb().upsertPcicCard(review('a1-n6', TODAY)); // the Learn tab introduced one after the round was planned
    expect(await introduceNewWord(getDb(), 'a1-n1', TODAY)).toBe('introduced');
    expect(await introduceNewWord(getDb(), 'a1-n2', TODAY)).toBe('no-budget'); // 2 of 2 introduced today
    expect(await getDb().getPcicCard('a1-n2')).toBeNull();
    expect((await getDb().getPcicCards()).filter((c) => c.introducedAt === TODAY)).toHaveLength(2);
  });

  it('the day bonus makes room again; a word that already started costs nothing and passes even with no budget', async () => {
    await getDb().upsertPcicCard(review('a1-n6', TODAY));
    await getDb().upsertPcicCard(review('a1-n7', TODAY));
    expect(await introduceNewWord(getDb(), 'a1-n1', TODAY)).toBe('no-budget');
    expect(await introduceNewWord(getDb(), 'a1-n6', TODAY)).toBe('started');
    await getDb().setPcicNewBonus(1, TODAY);
    expect(await introduceNewWord(getDb(), 'a1-n1', TODAY)).toBe('introduced');
  });

  it('an orphan card (its item is not in the corpus) does not use the budget', async () => {
    await getDb().upsertPcicCard(review('gone-1', TODAY));
    await getDb().upsertPcicCard(review('gone-2', TODAY));
    const exists = (id: string) => findItem(id) !== undefined;
    expect(await introduceNewWord(getDb(), 'a1-n1', TODAY, exists)).toBe('introduced');
    expect(await introduceNewWord(getDb(), 'a1-n2', TODAY)).toBe('no-budget'); // counted when nobody says which ids exist
  });
});

describe('an entry that starts with a word card', () => {
  const entry = (n: number, target: string, extra: Partial<SentenceEntry> = {}): SentenceEntry => ({
    itemId: `a1-n${n}`, source: target ? `Sentence ${n}.` : '', target, wordCount: target ? 2 : 0, wordIds: [], due: false, dueIds: [], staleness: '', slots: [], newWord: true, ...extra,
  });
  const round = (entries: SentenceEntry[]) => startRound(entries, TODAY, 'es', '', {});

  it('steps: the card, then the parts and the whole sentence on rung 1; the card alone without a sentence', () => {
    const chunks = [{ source: 'part 0', target: 'parte 0' }, { source: 'part 1', target: 'parte 1' }];
    expect(roundSteps([entry(1, 'libro.'), entry(2, ''), entry(3, 'frase larga', { chunks })], {}).map((s) => s.id)).toEqual([
      'a1-n1#newword', 'a1-n1#build', 'a1-n2#newword', 'a1-n3#newword', 'a1-n3#chunk0', 'a1-n3#chunk1', 'a1-n3#build',
    ]);
  });

  it('the card passes no rung; the sentence passes rung 1 with its last step; the card alone ends the round', () => {
    let r = round([entry(1, 'libro.')]);
    expect(currentStep(r)?.kind).toBe('newword');
    r = answerStep(r, true);
    expect(r.passed).toBeUndefined();
    expect(currentStep(r)?.kind).toBe('build');
    r = answerStep(r, true);
    expect(r.passed).toEqual(['a1-n1']);
    expect(r.phase).toBe('done');

    let alone = round([entry(2, '')]);
    alone = answerStep(alone, true);
    expect(alone.passed).toBeUndefined(); // no sentence key is ever written for a word with no sentence
    expect(alone.phase).toBe('done');
  });

  it('dropping entries: their steps leave the round, the queue and the done steps; with no step left the round is over', () => {
    const r0 = round([entry(1, 'libro.'), entry(2, ''), entry(3, '')]);
    const r1 = answerStep(r0, true); // the card of word 1 passed
    expect(unpassedNewWords(r1)).toEqual(['a1-n2', 'a1-n3']);
    const dropped = dropEntries(r1, ['a1-n2', 'a1-n3']);
    expect(dropped.entries.map((e) => e.itemId)).toEqual(['a1-n1']);
    expect(dropped.steps.map((st) => st.id)).toEqual(['a1-n1#newword', 'a1-n1#build']);
    expect(dropped.queue).toEqual(['a1-n1#build']);
    expect(dropped.done).toEqual(['a1-n1#newword']);
    expect(dropped.phase).toBe('steps');
    const none = dropEntries(r0, ['a1-n1', 'a1-n2', 'a1-n3']);
    expect(none).toMatchObject({ entries: [], steps: [], queue: [], done: [], phase: 'done' });
    expect(dropEntries(r0, [])).toBe(r0);
    // what is left of the round is a usable saved round
    expect(parseSentenceRound(JSON.parse(JSON.stringify(dropped)))).toEqual(dropped);
  });

  it('unpassedNewWords: the word card on screen and the ones after it, not the ones passed', () => {
    let r = round([entry(1, ''), entry(2, ''), entry(3, '')]);
    expect(unpassedNewWords(r)).toEqual(['a1-n1', 'a1-n2', 'a1-n3']);
    r = answerStep(r, true);
    expect(unpassedNewWords(r)).toEqual(['a1-n2', 'a1-n3']);
    r = answerStep(answerStep(r, true), true);
    expect(unpassedNewWords(r)).toEqual([]);
  });

  it('is saved with the round and read back (the card step, the flag); a malformed flag is not a usable round', () => {
    const r = answerStep(round([entry(1, 'libro.'), entry(2, '')]), true);
    const back = parseSentenceRound(JSON.parse(JSON.stringify(r)));
    expect(back).toEqual(r);
    expect(back?.entries.map((e) => e.newWord)).toEqual([true, true]);
    const broken = JSON.parse(JSON.stringify(r));
    broken.entries[0].newWord = 'yes';
    expect(parseSentenceRound(broken)).toBeNull();
    const old = JSON.parse(JSON.stringify(r));
    delete old.entries[0].newWord; // an entry without the flag is an ordinary sentence entry
    expect(parseSentenceRound(old)?.entries[0].newWord).toBeUndefined();
  });
});
