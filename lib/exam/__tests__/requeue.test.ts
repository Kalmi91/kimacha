// Az elrontott SZÓ-tétel kártyája `again` értékeléssel
// visszakerül az SM-2 ismétlésbe (azonnal esedékes); az elrontott nyelvtani (és olvasás-) tétel
// nem kap SM-2 változást.

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
  it('a hibás szó-tételek kártyái: beírás, összerakás, mondat-beírás és az egész párosítás', () => {
    expect(wrongWordItemIds([wrong(wordType), wrong(match), wrong(sentOrder), wrong(sentType)])).toEqual(['w1', 'm1', 'm2', 'm3', 'm4', 's1', 's2']);
  });

  it('a helyes válasz nem megy vissza', () => {
    expect(wrongWordItemIds([right(wordType), right(match), wrong(sentType)])).toEqual(['s2']);
  });

  it('nyelvtani és olvasás-tétel hibásan sem ad kártyát (A8 a)', () => {
    expect(wrongWordItemIds([wrong(gap), wrong(reading)])).toEqual([]);
  });

  it('ugyanaz a szó csak egyszer szerepel', () => {
    expect(wrongWordItemIds([wrong(wordType), wrong(wordType)])).toEqual(['w1']);
  });
});

describe('requeueWrongWords', () => {
  it('a hibás szó kártyája `again`-t kap: learning, ma esedékes, egy lapse', () => {
    const [card] = requeueWrongWords(allCards, [wrong(wordType)], TODAY);
    expect(card).toEqual(sm2Review(review('w1'), 'again', TODAY));
    expect(card).toMatchObject({ itemId: 'w1', state: 'learning', due: TODAY, lapses: 1, lastReview: TODAY });
  });

  it('a hibás szó nem számít többé tanultnak (nem `review`), ezért a tanulófül sorába kerül', () => {
    const next = requeueWrongWords(allCards, [wrong(sentOrder)], TODAY);
    expect(next.map((c) => c.state)).toEqual(['learning']);
  });

  it('csak a hibás szó-tételek kártyái változnak, a nyelvtani hiba után nincs SM-2 változás', () => {
    const results = [right(wordType), wrong(gap), wrong(reading), right(match)];
    expect(requeueWrongWords(allCards, results, TODAY)).toEqual([]);
  });

  it('a hibás párosítás mind a négy szavát visszaküldi', () => {
    expect(requeueWrongWords(allCards, [wrong(match)], TODAY).map((c) => c.itemId)).toEqual(['m1', 'm2', 'm3', 'm4']);
  });

  it('amelyik szónak nincs kártyája, azt kihagyja', () => {
    expect(requeueWrongWords([review('s2')], [wrong(wordType), wrong(sentType)], TODAY).map((c) => c.itemId)).toEqual(['s2']);
  });

  it('nem módosítja a kapott kártyákat', () => {
    const before = JSON.stringify(allCards);
    requeueWrongWords(allCards, [wrong(wordType)], TODAY);
    expect(JSON.stringify(allCards)).toBe(before);
  });
});
