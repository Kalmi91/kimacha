// Letter scramble round logic (lib/practice/scramble.ts): the word parts, the seeded shuffle, the taps, the saved-state check.

import type { PcicItem } from '@/data/pcic';
import {
  balancedRows,
  cellsPerRow,
  isScrambleUsable,
  nextScramble,
  parseScramble,
  scrambleDone,
  scramblePosition,
  scrambleScore,
  scrambleTiles,
  scrambleWord,
  seedOf,
  skipScramble,
  splitRows,
  startScramble,
  tapTile,
  type ScrambleState,
} from '../scramble';

const item = (id: string, es: string, en: string): PcicItem => ({ id, es, en, kind: 'word', section: '', order: 1 });
const CASA = item('a', 'la casa', 'house');

describe('scrambleWord', () => {
  it('Spanish noun: the article is fixed text, the letters are the places', () => {
    const w = scrambleWord(CASA, 'es');
    expect(w.article).toBe('la');
    expect(w.letters).toEqual(['c', 'a', 's', 'a']);
    expect(w.chars.map((c) => c.slot)).toEqual([0, 1, 2, 3]);
    expect(w.say).toBe('la casa');
    expect(w.meaning).toBe('house');
  });

  it('an accented letter is its own letter; a phrase keeps its space as fixed text', () => {
    const w = scrambleWord(item('b', 'buenos días', 'good morning'), 'es');
    expect(w.article).toBe('');
    expect(w.letters).toEqual(['b', 'u', 'e', 'n', 'o', 's', 'd', 'í', 'a', 's']);
    expect(w.chars[6]).toEqual({ ch: ' ', slot: null });
    expect(w.chars[7]).toEqual({ ch: 'd', slot: 6 });
    expect(w.letters).not.toContain('i');
  });

  it('takes the first alternative, English direction has no article', () => {
    expect(scrambleWord(item('c', 'el carro / el coche', 'car'), 'es')).toMatchObject({ article: 'el', say: 'el carro' });
    const en = scrambleWord(item('d', 'la camisa', 'shirt'), 'en');
    expect(en).toMatchObject({ article: '', letters: ['s', 'h', 'i', 'r', 't'], meaning: 'la camisa' });
  });

  it('a word needs two different letters', () => {
    expect(isScrambleUsable(CASA, 'es')).toBe(true);
    expect(isScrambleUsable(item('e', 'y', 'and'), 'es')).toBe(false);
    expect(isScrambleUsable(item('f', 'oo', 'x'), 'es')).toBe(false);
    expect(isScrambleUsable(item('g', 'sí', 'yes'), 'es')).toBe(true);
  });
});

describe('scrambleTiles', () => {
  const letters = ['c', 'a', 's', 'a'];
  it('is the same letters, the same every time for one seed, and never the original order', () => {
    const tiles = scrambleTiles(letters, seedOf('a'));
    expect([...tiles].sort()).toEqual([...letters].sort());
    expect(scrambleTiles(letters, seedOf('a'))).toEqual(tiles);
    expect(tiles).not.toEqual(letters);
  });
  it('never the original order for any seed, even a two-letter word', () => {
    for (let n = 0; n < 200; n++) {
      expect(scrambleTiles(['n', 'o'], n)).toEqual(['o', 'n']);
      expect(scrambleTiles(letters, n)).not.toEqual(letters);
    }
  });
  it('different words are shuffled differently', () => {
    expect(seedOf('o19')).not.toBe(seedOf('o20'));
  });
});

describe('balancedRows', () => {
  it('splits evenly, longer rows first, never a lone cell in the last row', () => {
    expect(balancedRows(7, 6)).toEqual([4, 3]);
    expect(balancedRows(8, 6)).toEqual([4, 4]);
    expect(balancedRows(13, 6)).toEqual([5, 4, 4]);
    expect(balancedRows(5, 6)).toEqual([5]);
    expect(balancedRows(6, 6)).toEqual([6]);
    expect(balancedRows(0, 6)).toEqual([]);
  });
  it('rows add up to the count, differ by at most one and fit perRow', () => {
    for (let perRow = 1; perRow <= 8; perRow++) {
      for (let count = 1; count <= 40; count++) {
        const rows = balancedRows(count, perRow);
        expect(rows.reduce((a, b) => a + b, 0)).toBe(count);
        expect(rows.length).toBe(Math.ceil(count / perRow));
        expect(Math.max(...rows) - Math.min(...rows)).toBeLessThanOrEqual(1);
        expect(Math.max(...rows)).toBeLessThanOrEqual(perRow);
        if (perRow >= 3 && count > perRow) expect(rows[rows.length - 1]).toBeGreaterThan(1);
      }
    }
  });
  it('a perRow below 1 is one cell per row', () => {
    expect(balancedRows(3, 0)).toEqual([1, 1, 1]);
  });
});

describe('splitRows', () => {
  it('cuts the items in order into the balanced rows', () => {
    expect(splitRows([0, 1, 2, 3, 4, 5, 6], 6)).toEqual([[0, 1, 2, 3], [4, 5, 6]]);
    expect(splitRows([], 6)).toEqual([]);
  });
});

describe('cellsPerRow', () => {
  it('counts the cells and the gaps between them, at least one', () => {
    expect(cellsPerRow(304, 44, 8)).toBe(6);
    expect(cellsPerRow(303, 44, 8)).toBe(5);
    expect(cellsPerRow(10, 44, 8)).toBe(1);
    expect(cellsPerRow(-20, 44, 8)).toBe(1);
  });
});

describe('a round of letters', () => {
  const letters = ['c', 'a', 's', 'a'];
  const tiles = ['s', 'a', 'a', 'c'];
  const start = startScramble(['a', 'b']);

  it('right letters in order fill the places; the last one finishes the word clean', () => {
    let s = start;
    for (const idx of [3, 1, 0]) {
      const r = tapTile(s, letters, tiles, idx);
      expect(r.hit).toBe(true);
      s = r.state;
    }
    expect(s.finished).toBeNull();
    expect(s.used).toEqual([3, 1, 0]);
    const last = tapTile(s, letters, tiles, 2);
    expect(last.state).toMatchObject({ finished: 'clean', clean: ['a'], used: [3, 1, 0, 2] });
    expect(scrambleScore(last.state)).toBe(1);
  });

  it('a wrong letter is a mistake and changes nothing else; a word with a mistake is flawed, not clean', () => {
    const wrong = tapTile(start, letters, tiles, 0);
    expect(wrong.hit).toBe(false);
    expect(wrong.state).toMatchObject({ mistakes: 1, used: [], finished: null });
    let s = wrong.state;
    for (const idx of [3, 1, 0, 2]) s = tapTile(s, letters, tiles, idx).state;
    expect(s).toMatchObject({ finished: 'flawed', clean: [], mistakes: 1 });
    expect(scrambleScore(s)).toBe(0);
  });

  it('a used tile, a tile out of range and a tap after the end are ignored', () => {
    const one = tapTile(start, letters, tiles, 3).state;
    expect(tapTile(one, letters, tiles, 3)).toEqual({ state: one, hit: null });
    expect(tapTile(one, letters, tiles, 9).hit).toBeNull();
    const skipped = skipScramble(start);
    expect(tapTile(skipped, letters, tiles, 3).hit).toBeNull();
  });

  it('Skip finishes the word with no score; Next moves on and clears the word', () => {
    const skipped = skipScramble(start);
    expect(skipped.finished).toBe('skipped');
    expect(skipScramble(skipped)).toBe(skipped);
    const moved = nextScramble(skipped);
    expect(moved).toMatchObject({ queue: ['b'], used: [], mistakes: 0, finished: null, turn: 1, clean: [] });
    expect(nextScramble(start)).toBe(start);
    expect(scrambleDone(nextScramble(skipScramble(moved)))).toBe(true);
    expect(scramblePosition(moved, 2)).toBe(2);
  });
});

describe('parseScramble', () => {
  const ids = ['a', 'b'];
  const ctx = { items: [CASA, item('b', 'el perro', 'dog')], target: 'es' as const };
  const good: ScrambleState = { queue: ['a', 'b'], used: [1, 0], mistakes: 2, finished: null, clean: [], turn: 0 };

  it('takes a state that fits the words', () => {
    expect(parseScramble(good, ids, ctx)).toEqual(good);
    expect(parseScramble({ ...good, used: [0, 1, 2, 3], finished: 'flawed' }, ids, ctx)?.finished).toBe('flawed');
    expect(parseScramble({ ...good, used: [], finished: 'skipped' }, ids, ctx)?.finished).toBe('skipped');
    expect(parseScramble({ ...good, queue: [], used: [], mistakes: 0, clean: ['a', 'b'] }, ids, ctx)?.queue).toEqual([]);
  });

  it('refuses a broken or foreign one', () => {
    expect(parseScramble(null, ids, ctx)).toBeNull();
    expect(parseScramble({ ...good, queue: ['a', 'zzz'] }, ids, ctx)).toBeNull();
    expect(parseScramble({ ...good, used: [0, 0] }, ids, ctx)).toBeNull();
    expect(parseScramble({ ...good, used: [0, 7] }, ids, ctx)).toBeNull();
    expect(parseScramble({ ...good, used: [0, 1, 2, 3] }, ids, ctx)).toBeNull();
    expect(parseScramble({ ...good, finished: 'clean' }, ids, ctx)).toBeNull();
    expect(parseScramble({ ...good, used: [0, 1, 2, 3], finished: 'clean' }, ids, ctx)).toBeNull();
    expect(parseScramble({ ...good, mistakes: -1 }, ids, ctx)).toBeNull();
    expect(parseScramble({ ...good, finished: 'maybe' }, ids, ctx)).toBeNull();
    expect(parseScramble({ ...good, queue: [], used: [0] }, ids, ctx)).toBeNull();
  });
});
