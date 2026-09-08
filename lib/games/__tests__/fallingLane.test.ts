// FB162: a falling tile owns its lane, whatever the word and the tile count.
import { fallingLane, laneFallDurations, LANE_GUTTER } from '@/lib/games/wordRain';

const BOARD = 358; // 390dp phone

describe('word-rain lane placement', () => {
  it.each([3, 4, 5, 6])('keeps every tile inside the board with %i tiles', (count) => {
    for (let i = 0; i < count; i++) {
      const lane = fallingLane(i, count, BOARD);
      expect(lane.x).toBeGreaterThanOrEqual(0);
      expect(lane.x + lane.width).toBeLessThanOrEqual(BOARD);
      expect(lane.width).toBeGreaterThan(0);
    }
  });

  it.each([3, 4, 5, 6])('never overlaps two tiles with %i tiles', (count) => {
    for (let i = 1; i < count; i++) {
      const prev = fallingLane(i - 1, count, BOARD);
      const cur = fallingLane(i, count, BOARD);
      expect(cur.x).toBeGreaterThanOrEqual(prev.x + prev.width);
    }
  });

  it('splits the board evenly', () => {
    const lane = fallingLane(0, 4, BOARD);
    expect(lane.width).toBeCloseTo(BOARD / 4 - LANE_GUTTER * 2);
  });
});

// GAMES.md 4.1: "különböző sebességgel" — the tiles of one round must NOT all
// fall at the same speed (they did before: every tile got currentDurationMs()).
describe('laneFallDurations (GAMES.md 4.1 varied speeds)', () => {
  it('gives the lanes of a round different durations', () => {
    const durations = laneFallDurations(5, 5000, 7, 2200);
    expect(durations).toHaveLength(5);
    expect(new Set(durations).size).toBeGreaterThan(1);
  });

  it('stays centred on the base speed', () => {
    const durations = laneFallDurations(4, 5000, 0, 2200);
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    expect(Math.abs(avg - 5000)).toBeLessThan(250);
  });

  it('never falls below the floor', () => {
    const durations = laneFallDurations(6, 2400, 3, 2200);
    for (const d of durations) expect(d).toBeGreaterThanOrEqual(2200);
  });

  it('does not always make the same lane the fast one', () => {
    const first = laneFallDurations(4, 5000, 0, 2200);
    const second = laneFallDurations(4, 5000, 1, 2200);
    expect(first).not.toEqual(second);
  });
});
