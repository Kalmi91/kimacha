import { deferRecent, recentKey, rememberRecent } from '../recentGuard';

const card = (wordId: number, type = 'word') => ({ wordId, type });

describe('recentKey', () => {
  it('separates the word card from the sentence card of the same word', () => {
    expect(recentKey(card(7, 'word'))).not.toBe(recentKey(card(7, 'sentence')));
  });
});

describe('rememberRecent', () => {
  it('keeps at most `gap` keys, dropping the oldest', () => {
    let recent: string[] = [];
    for (const id of [1, 2, 3, 4]) recent = rememberRecent(recent, recentKey(card(id)), 3);
    expect(recent).toEqual(['2:word', '3:word', '4:word']);
  });

  it('moves a re-seen card to the freshest end instead of duplicating it', () => {
    let recent = rememberRecent(rememberRecent([], '1:word', 5), '2:word', 5);
    recent = rememberRecent(recent, '1:word', 5);
    expect(recent).toEqual(['2:word', '1:word']);
  });

  it('remembers nothing when the gap is zero', () => {
    expect(rememberRecent(['1:word'], '2:word', 0)).toEqual([]);
  });
});

describe('deferRecent', () => {
  it('leaves the queue alone when nothing was seen yet', () => {
    const items = [card(1), card(2)];
    expect(deferRecent(items, [])).toBe(items);
  });

  it('FB213: the card just answered does not open the rebuilt queue', () => {
    const items = [card(1), card(2), card(3)];
    const out = deferRecent(items, ['1:word']);
    expect(out.map((i) => i.wordId)).toEqual([2, 3, 1]);
  });

  it('orders the seen cards oldest-first, so the freshest waits longest', () => {
    const items = [card(1), card(2), card(3)];
    const out = deferRecent(items, ['3:word', '1:word']);
    expect(out.map((i) => i.wordId)).toEqual([2, 3, 1]);
  });

  it('never empties the queue when every card was seen', () => {
    const items = [card(1), card(2)];
    const out = deferRecent(items, ['2:word', '1:word']);
    expect(out.map((i) => i.wordId)).toEqual([2, 1]);
  });

  it('holds back only the card type that was seen', () => {
    const items = [card(5, 'word'), card(5, 'sentence')];
    const out = deferRecent(items, ['5:word']);
    expect(out.map((i) => i.type)).toEqual(['sentence', 'word']);
  });
});
