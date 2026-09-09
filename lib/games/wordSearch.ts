// GAMES.md 4.4 (F1, word-search): "a rács-generátor tiszta függvény legyen
// lib/games/wordSearch.ts-ben, jest-tesztekkel". buildGrid takes the exact
// words the game screen picked from getLearnedPool (GAMES.md 0.: the pool
// rule, this module never invents a word), a size, and a direction mode, and
// lays them into a letter grid, backtracking-style: a fast random-placement
// pass first, then an exhaustive deterministic fallback so a word is only
// ever left unplaced when it truly cannot fit (GAMES.md 4.4 acceptance: "12×12
// rács 10 szóval < 50 ms alatt generálódik, 200 futásból 0 sikertelen
// elhelyezés").

export type WordSearchDirections = 'orthogonal' | 'diagonal' | 'reverse';

export interface WordPlacement {
  word: string; // normalized (uppercase, letters only) as placed in the grid
  row: number;
  col: number;
  dr: number;
  dc: number;
}

export interface WordSearchGrid {
  grid: string[][];
  placements: WordPlacement[];
}

// K9/4.4 DÖNTÉS-consistent direction tiers: 'orthogonal' = right/down only (the
// simplest, most readable puzzle), 'diagonal' adds the two forward diagonals,
// 'reverse' opens all 8 directions (backwards reading included).
const DIRECTION_VECTORS: Record<WordSearchDirections, [number, number][]> = {
  orthogonal: [
    [0, 1],
    [1, 0],
  ],
  diagonal: [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ],
  reverse: [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ],
};

// GAMES.md 4.4: "kitöltés a tanult nyelv betűgyakorisága szerint (spanyolnál ñ,
// á, é is bekerül, hogy ne legyen árulkodó)". A rough Spanish frequency table
// (repeated letters weight more often); any other learned language falls back
// to a plain, unweighted Latin alphabet.
const FILLER_DEFAULT = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Issue #3: nyelvenkénti kitöltő-ábécé táblából. Aminek nincs saját sora, az a
// sima latin ábécét kapja; egy új nyelv egy bejegyzés, nem egy `if` ág.
const FILLER_BY_LANG: Record<string, string> = {
  es: 'EEEEAAAAOOOOSSSSRRRRNNNNIIIILLLLDDDDTTTTCCCCUUUUMMMMPPPPBBGGVVYYQQHHFFZZJJÑÁÉÍÓÚ',
};

function fillerAlphabet(lang: string): string {
  return FILLER_BY_LANG[lang] ?? FILLER_DEFAULT;
}

export function normalizeForGrid(word: string): string {
  return word
    .toUpperCase()
    .normalize('NFC')
    .replace(/[^A-ZÑÁÉÍÓÚÜ]/g, '');
}

export function buildGrid(
  words: string[],
  size: number,
  dirs: WordSearchDirections,
  rng: () => number,
  lang: string = 'es'
): WordSearchGrid {
  const grid: (string | null)[][] = Array.from({ length: size }, () => Array<string | null>(size).fill(null));
  const placements: WordPlacement[] = [];
  const vectors = DIRECTION_VECTORS[dirs];

  const normalized = [...new Set(words.map(normalizeForGrid).filter((w) => w.length > 0 && w.length <= size))].sort(
    (a, b) => b.length - a.length
  );

  const canPlace = (word: string, row: number, col: number, dr: number, dc: number): boolean => {
    for (let i = 0; i < word.length; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      if (r < 0 || r >= size || c < 0 || c >= size) return false;
      const cell = grid[r][c];
      if (cell !== null && cell !== word[i]) return false;
    }
    return true;
  };

  const place = (word: string, row: number, col: number, dr: number, dc: number) => {
    for (let i = 0; i < word.length; i++) {
      grid[row + dr * i][col + dc * i] = word[i];
    }
    placements.push({ word, row, col, dr, dc });
  };

  for (const word of normalized) {
    let placed = false;

    // Fast path: a handful of random tries, succeeds almost always on a
    // grid this small.
    for (let attempt = 0; attempt < 60 && !placed; attempt++) {
      const [dr, dc] = vectors[Math.floor(rng() * vectors.length)];
      const row = Math.floor(rng() * size);
      const col = Math.floor(rng() * size);
      if (canPlace(word, row, col, dr, dc)) {
        place(word, row, col, dr, dc);
        placed = true;
      }
    }

    // Deterministic fallback: exhaustively try every cell/direction (in a
    // shuffled order so repeated runs don't all pick the same spot) before
    // giving up on the word. Guarantees a placement whenever one exists.
    if (!placed) {
      const cells: number[] = [];
      for (let i = 0; i < size * size; i++) cells.push(i);
      for (let i = cells.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [cells[i], cells[j]] = [cells[j], cells[i]];
      }
      const vecOrder = vectors.map((_, i) => i);
      for (let i = vecOrder.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [vecOrder[i], vecOrder[j]] = [vecOrder[j], vecOrder[i]];
      }

      outer: for (const cellIdx of cells) {
        const row = Math.floor(cellIdx / size);
        const col = cellIdx % size;
        for (const vi of vecOrder) {
          const [dr, dc] = vectors[vi];
          if (canPlace(word, row, col, dr, dc)) {
            place(word, row, col, dr, dc);
            placed = true;
            break outer;
          }
        }
      }
    }
    // If STILL unplaced, the word truly doesn't fit this grid; it's skipped
    // (the caller decides whether to swap in a smaller word, GAMES.md 4.4).
  }

  const fillers = fillerAlphabet(lang);
  const finalGrid: string[][] = grid.map((row) => row.map((cell) => cell ?? fillers[Math.floor(rng() * fillers.length)]));

  return { grid: finalGrid, placements };
}
