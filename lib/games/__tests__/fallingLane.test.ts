// FB162: a falling tile owns its lane, whatever the word and the tile count.
import { fallingLane, LANE_GUTTER } from '@/lib/games/wordRain';

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
