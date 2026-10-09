// The card of a failed WORD item goes back into SM-2 review with an `again` rating (due
// immediately); a failed grammar (or reading) item gets no SM-2 change.

import { sm2NewCard, sm2Review, type Sm2Card } from '@/lib/sm2';
import { requeueWrongWords, wrongWordItemIds } from '../requeue';
import type { ExamItem, ExamItemResult } from '../types';

const TODAY = '2026-10-01';
const review = (itemId: string): Sm2Card => ({ ...sm2NewCard(itemId), state: 'review', interval: 7, reps: 3, due: '2026-10-08', lastReview: '2026-09-24' });

const wordType: ExamItem = { kind: 'word_type', skill: 'words', itemId: 'w1', prompt: 'the window', answer: 'la ventana' };
const match: ExamItem = {
  kind: 'match',
  skill: 'words',
  itemIds: ['m1', 'm2', 'm3', 'm4'],
  pairs: [
    { left: 'la casa', right: 'the house' },
    { left: 'el libro', right: 'the book' },
    { left: 'la mesa', right: 'the table' },
    { left: 'el agua', right: 'the water' },
  ],
};
const sentOrder: ExamItem = { kind: 'sent_order', skill: 'words', itemId: 's1', prompt: 'I eat at home.', answerTokens: ['yo', 'como', 'en', 'casa'], sentence: 'Yo como en casa.', distractors: [] };
const sentType: ExamItem = { kind: 'sent_type', skill: 'words', itemId: 's2', prompt: 'We live here.', answer: 'Vivimos aquí.' };
const gap: ExamItem = { kind: 'gap_mc', skill: 'grammar', topicId: 'presente-regular', sentence: 'Yo ___ español.', options: ['hablo', 'hablas', 'habla'], correctIndex: 0 };
const reading: ExamItem = { kind: 'reading_mc', skill: 'reading', itemIds: ['r1', 'r2'], text: 'Tengo un perro.', options: ['a', 'b', 'c'], correctIndex: 0 };

const wrong = (item: ExamItem): ExamItemResult => ({ item, correct: false });
const right = (item: ExamItem): ExamItemResult => ({ item, correct: true });
const allCards = ['w1', 'm1', 'm2', 'm3', 'm4', 's1', 's2', 'r1', 'r2'].map(review);

describe('wrongWordItemIds', () => {
  it('the cards of the wrong word items: typing, build, sentence typing and the whole matching', () => {
    expect(wrongWordItemIds([wrong(wordType), wrong(match), wrong(sentOrder), wrong(sentType)])).toEqual(['w1', 'm1', 'm2', 'm3', 'm4', 's1', 's2']);
  });

  it('the right answer does not go back', () => {
    expect(wrongWordItemIds([right(wordType), right(match), wrong(sentType)])).toEqual(['s2']);
  });

  it('a grammar or reading item gives no card even when wrong', () => {
    expect(wrongWordItemIds([wrong(gap), wrong(reading)])).toEqual([]);
  });

  it('the same word appears only once', () => {
    expect(wrongWordItemIds([wrong(wordType), wrong(wordType)])).toEqual(['w1']);
  });
});

describe('requeueWrongWords', () => {
  it('the card of the wrong word gets `again`: learning, due today, one lapse', () => {
    const [card] = requeueWrongWords(allCards, [wrong(wordType)], TODAY);
    expect(card).toEqual(sm2Review(review('w1'), 'again', TODAY));
    expect(card).toMatchObject({ itemId: 'w1', state: 'learning', due: TODAY, lapses: 1, lastReview: TODAY });
  });

  it('the wrong word no longer counts as learned (not `review`), so it goes to the Learn tab queue', () => {
    const next = requeueWrongWords(allCards, [wrong(sentOrder)], TODAY);
    expect(next.map((c) => c.state)).toEqual(['learning']);
  });

  it('only the cards of the wrong word items change, after a grammar error there is no SM-2 change', () => {
    const results = [right(wordType), wrong(gap), wrong(reading), right(match)];
    expect(requeueWrongWords(allCards, results, TODAY)).toEqual([]);
  });

  it('a wrong matching sends back all four of its words', () => {
    expect(requeueWrongWords(allCards, [wrong(match)], TODAY).map((c) => c.itemId)).toEqual(['m1', 'm2', 'm3', 'm4']);
  });

  it('a word that has no card is skipped', () => {
    expect(requeueWrongWords([review('s2')], [wrong(wordType), wrong(sentType)], TODAY).map((c) => c.itemId)).toEqual(['s2']);
  });

  it('it does not modify the given cards', () => {
    const before = JSON.stringify(allCards);
    requeueWrongWords(allCards, [wrong(wordType)], TODAY);
    expect(JSON.stringify(allCards)).toBe(before);
  });
});
