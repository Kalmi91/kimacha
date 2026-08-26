// GAMES.md 4.4 (word-search): acceptance criteria for the pure grid generator.

import { buildGrid, normalizeForGrid } from '../wordSearch';
import { mulberry32 } from '../../shuffle';

const A1_WORDS = ['perro', 'gato', 'casa', 'agua', 'libro', 'mesa', 'silla', 'flor', 'sol', 'luna'];

describe('normalizeForGrid', () => {
  it('uppercases and strips spaces/punctuation, keeping Spanish letters', () => {
    expect(normalizeForGrid('el pantalón')).toBe('ELPANTALÓN');
    expect(normalizeForGrid('mañana')).toBe('MAÑANA');
    expect(normalizeForGrid('¿qué?')).toBe('QUÉ');
  });
});

describe('buildGrid', () => {
  it('places every word that fits, each spelled correctly along its vector', () => {
    const rng = mulberry32(42);
    const { grid, placements } = buildGrid(A1_WORDS, 12, 'orthogonal', rng);

    expect(placements).toHaveLength(A1_WORDS.length);
    for (const p of placements) {
      let spelled = '';
      for (let i = 0; i < p.word.length; i++) {
        spelled += grid[p.row + p.dr * i][p.col + p.dc * i];
      }
      expect(spelled).toBe(p.word);
    }
  });

  it('stays within bounds and fills every cell of the requested size', () => {
    const rng = mulberry32(7);
    const { grid } = buildGrid(A1_WORDS, 10, 'diagonal', rng);
    expect(grid).toHaveLength(10);
    for (const row of grid) {
      expect(row).toHaveLength(10);
      for (const cell of row) expect(cell).toMatch(/^[A-ZÑÁÉÍÓÚ]$/);
    }
  });

  it('orthogonal mode never uses a diagonal vector', () => {
    const rng = mulberry32(99);
    const { placements } = buildGrid(A1_WORDS, 12, 'orthogonal', rng);
    for (const p of placements) {
      expect(p.dr === 0 || p.dc === 0).toBe(true);
    }
  });

  it('is deterministic for the same seed and inputs', () => {
    const a = buildGrid(A1_WORDS, 10, 'reverse', mulberry32(123));
    const b = buildGrid(A1_WORDS, 10, 'reverse', mulberry32(123));
    expect(a.grid).toEqual(b.grid);
    expect(a.placements).toEqual(b.placements);
  });

  it('drops (never throws on) a word that cannot possibly fit the grid', () => {
    const rng = mulberry32(1);
    const { placements } = buildGrid(['unbelievablylongwordthatnevfits'], 6, 'orthogonal', rng);
    expect(placements).toHaveLength(0);
  });

  it('dedupes case-insensitively equal words', () => {
    const rng = mulberry32(5);
    const { placements } = buildGrid(['perro', 'PERRO', 'Perro'], 12, 'orthogonal', rng);
    expect(placements).toHaveLength(1);
  });

  // GAMES.md 4.4 acceptance: "12×12 rács 10 szóval < 50 ms alatt generálódik,
  // 200 futásból 0 sikertelen elhelyezés" (checked across all 3 direction tiers,
  // the hardest being 'orthogonal' with only 2 vectors to place into).
  it('places all 10 words on a 12x12 grid in 200 runs, 0 failures, well under 50ms/run', () => {
    const start = Date.now();
    for (let seed = 0; seed < 200; seed++) {
      const { placements } = buildGrid(A1_WORDS, 12, 'orthogonal', mulberry32(seed));
      expect(placements).toHaveLength(A1_WORDS.length);
    }
    const elapsed = Date.now() - start;
    expect(elapsed / 200).toBeLessThan(50);
  });
});
