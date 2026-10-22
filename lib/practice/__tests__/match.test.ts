// Quick match round logic (lib/practice/match.ts): the tables, the pairs, the clock, the saved-state check, the best time.

import type { PcicItem } from '@/data/pcic';
import {
  MATCH_BOARD_SIZE,
  MATCH_ROUND_MS,
  boardColumns,
  buildBoards,
  currentBoard,
  loadMatchBest,
  matchCard,
  matchTotal,
  parseMatch,
  recordMatchTime,
  startMatch,
  tickMatch,
  tryPair,
  usedMs,
  type MatchState,
} from '../match';

const word = (id: string, es: string, en: string): PcicItem => ({ id, es, en, kind: 'word', section: '', order: 1 });
const items = Array.from({ length: 20 }, (_, i) => word(`w${i}`, `la palabra${i}`, `meaning ${i}`));
const ids = items.map((i) => i.id);

describe('the tables', () => {
  it('3 tables of 5 pairs, in word order', () => {
    const boards = buildBoards(items);
    expect(boards.map((b) => b.length)).toEqual([5, 5, 5]);
    expect(boards[0]).toEqual(['w0', 'w1', 'w2', 'w3', 'w4']);
    expect(boards.flat()).toHaveLength(15);
  });

  it('two words with the same English text never share a table; a word with no room is passed over', () => {
    const same = [word('a', 'ser', 'to be'), word('b', 'estar', 'To be'), ...items.slice(0, 14)];
    const boards = buildBoards(same);
    for (const board of boards) {
      const meanings = board.map((id) => matchCard(same.find((i) => i.id === id)!).en.toLowerCase());
      expect(new Set(meanings).size).toBe(meanings.length);
    }
    expect(boards.flat()).toHaveLength(15);
    const onlyDuplicates = Array.from({ length: 6 }, (_, i) => word(`d${i}`, `uno${i}`, 'one'));
    expect(buildBoards(onlyDuplicates).flat()).toHaveLength(3);
  });

  it('fewer words give smaller tables; a card shows the Spanish with its article and the English', () => {
    expect(buildBoards(items.slice(0, 7)).map((b) => b.length)).toEqual([5, 2]);
    expect(matchCard(word('x', 'el carro / el coche', 'car'))).toEqual({ es: 'el carro', en: 'car' });
  });

  it('both columns hold the same cards, shuffled the same way every time, not in table order', () => {
    const board = ['w0', 'w1', 'w2', 'w3', 'w4'];
    const cols = boardColumns(board);
    expect([...cols.es].sort()).toEqual(board);
    expect([...cols.en].sort()).toEqual(board);
    expect(cols.es).not.toEqual(board);
    expect(cols.en).not.toEqual(board);
    expect(cols.en).not.toEqual(cols.es);
    expect(boardColumns(board)).toEqual(cols);
  });
});

describe('pairs', () => {
  const start = startMatch(ids, { items });

  it('starts with the whole minute and no pair found', () => {
    expect(start).toMatchObject({ found: [], firstTry: [], missed: [], leftMs: MATCH_ROUND_MS, over: null });
    expect(matchTotal(start)).toBe(15);
    expect(currentBoard(start)).toBe(0);
  });

  it('a right pair is found, on the first try it counts for a half', () => {
    const r = tryPair(start, 'w0', 'w0');
    expect(r).toMatchObject({ hit: true, firstTry: true });
    expect(r.state).toMatchObject({ found: ['w0'], firstTry: ['w0'] });
  });

  it('a wrong pair marks both words and changes nothing else; the pair found later is no first try', () => {
    const miss = tryPair(start, 'w0', 'w1');
    expect(miss.hit).toBe(false);
    expect(miss.state).toMatchObject({ missed: ['w0', 'w1'], found: [], firstTry: [], leftMs: MATCH_ROUND_MS });
    expect(tryPair(miss.state, 'w0', 'w0')).toMatchObject({ hit: true, firstTry: false });
    expect(tryPair(miss.state, 'w2', 'w2')).toMatchObject({ hit: true, firstTry: true });
  });

  it('a card that is gone, or a round that is over, ignores the tap', () => {
    const one = tryPair(start, 'w0', 'w0').state;
    expect(tryPair(one, 'w0', 'w1').hit).toBeNull();
    expect(tryPair({ ...start, over: 'time' }, 'w1', 'w1').hit).toBeNull();
  });

  it('the table in play moves on when its 5 pairs are found; the last pair ends the round', () => {
    let s = start;
    for (const id of ids.slice(0, 5)) s = tryPair(s, id, id).state;
    expect(currentBoard(s)).toBe(1);
    expect(s.over).toBeNull();
    for (const id of ids.slice(5, 15)) s = tryPair(s, id, id).state;
    expect(s.over).toBe('all');
    expect(currentBoard(s)).toBe(-1);
    expect(s.firstTry).toHaveLength(15);
  });
});

describe('the clock', () => {
  const start = startMatch(ids, { items });
  it('counts down and ends the round at 0, once', () => {
    const s = tickMatch(start, 12_250);
    expect(s).toMatchObject({ leftMs: 47_750, over: null });
    expect(usedMs(s)).toBe(12_250);
    const end = tickMatch(s, 90_000);
    expect(end).toMatchObject({ leftMs: 0, over: 'time' });
    expect(usedMs(end)).toBe(MATCH_ROUND_MS);
    expect(tickMatch(end, 1000)).toBe(end);
  });
});

describe('parseMatch', () => {
  const start = startMatch(ids, { items });
  const mid: MatchState = { ...start, found: ['w0', 'w1'], firstTry: ['w0'], missed: ['w1', 'w7'], leftMs: 31_000 };
  it('takes a state that fits the words, saved with the time left', () => {
    expect(parseMatch(JSON.parse(JSON.stringify(mid)), ids)).toEqual(mid);
    expect(parseMatch(JSON.parse(JSON.stringify(tickMatch(start, MATCH_ROUND_MS))), ids)?.over).toBe('time');
  });
  it('refuses a broken or foreign one', () => {
    expect(parseMatch(null, ids)).toBeNull();
    expect(parseMatch({ ...mid, boards: [] }, ids)).toBeNull();
    expect(parseMatch({ ...mid, boards: [...mid.boards, ['w16']] }, ids)).toBeNull();
    expect(parseMatch({ ...mid, boards: [['w0', 'w1', 'w2', 'w3', 'w4', 'w5']] }, ids)).toBeNull();
    expect(parseMatch({ ...mid, boards: [['w0', 'zzz']] }, ids)).toBeNull();
    expect(parseMatch({ ...mid, found: ['w19'] }, ids)).toBeNull();
    expect(parseMatch({ ...mid, firstTry: ['w9'] }, ids)).toBeNull();
    expect(parseMatch({ ...mid, leftMs: -1 }, ids)).toBeNull();
    expect(parseMatch({ ...mid, leftMs: MATCH_ROUND_MS + 1 }, ids)).toBeNull();
    expect(parseMatch({ ...mid, leftMs: 0 }, ids)).toBeNull();
    expect(parseMatch({ ...mid, over: 'time' }, ids)).toBeNull();
    expect(parseMatch({ ...mid, over: 'all' }, ids)).toBeNull();
    expect(parseMatch({ ...mid, over: 'maybe' }, ids)).toBeNull();
  });
  it(`a table never holds more than ${MATCH_BOARD_SIZE} pairs`, () => {
    expect(MATCH_BOARD_SIZE).toBe(5);
  });
});

describe('the best time', () => {
  it('keeps the fastest complete round', async () => {
    expect(await loadMatchBest()).toBeNull();
    expect(await recordMatchTime(41_000)).toBe(41_000);
    expect(await recordMatchTime(52_000)).toBe(41_000);
    expect(await recordMatchTime(38_500)).toBe(38_500);
    expect(await loadMatchBest()).toBe(38_500);
  });
});
