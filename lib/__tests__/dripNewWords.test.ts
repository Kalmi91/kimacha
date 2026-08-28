// FB163: new words are spread through the reviews, one at a time.
import { dripNewWords, type DueItem } from '@/lib/sessionQueue';

const item = (id: number, reps: number, type = 'word'): DueItem =>
  ({ wordId: id, type, card: { reps } as any, word: {} as any, isTyping: false });

const shape = (items: DueItem[]) =>
  items.map((i) => (i.type === 'word' && (i.card.reps ?? 0) === 0 ? 'N' : 'r')).join('');

describe('dripNewWords', () => {
  it('spreads new words evenly through the reviews', () => {
    const items = [item(1, 0), item(2, 0), item(3, 0), ...Array.from({ length: 9 }, (_, i) => item(10 + i, 3))];
    expect(shape(dripNewWords(items))).toBe('NrrrNrrrNrrr');
  });

  it('never puts two new words back to back while reviews remain', () => {
    const items = [...Array.from({ length: 4 }, (_, i) => item(i + 1, 0)), ...Array.from({ length: 8 }, (_, i) => item(20 + i, 5))];
    expect(shape(dripNewWords(items))).not.toMatch(/NN/);
  });

  it('keeps every card, new and review alike', () => {
    const items = [item(1, 0), item(2, 4), item(3, 0), item(4, 2)];
    const out = dripNewWords(items);
    expect(out).toHaveLength(items.length);
    expect(out.map((i) => i.wordId).sort()).toEqual([1, 2, 3, 4]);
  });

  it('leaves a review-only or new-only queue untouched', () => {
    const reviews = [item(1, 2), item(2, 3)];
    expect(dripNewWords(reviews)).toBe(reviews);
    const news = [item(1, 0), item(2, 0)];
    expect(dripNewWords(news)).toBe(news);
  });

  it('treats a due sentence as review material, not as a new word', () => {
    const items = [item(1, 0, 'sentence'), item(2, 0), item(3, 4), item(4, 4)];
    // the fresh sentence counts as review material, so the one new WORD leads
    expect(shape(dripNewWords(items))).toBe('Nrrr');
  });
});
