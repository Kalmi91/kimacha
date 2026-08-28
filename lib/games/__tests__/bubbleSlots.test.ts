// FB162: 12-16 bubbles have to sit on a grid, not on top of each other.
import { bubbleSlot, bubbleColumns, BUBBLE_SIZE } from '@/lib/games/bubblePop';

describe('bubble grid placement', () => {
  it('only uses as many columns as fit the board', () => {
    expect(bubbleColumns(358)).toBe(5); // 390dp phone
    expect(bubbleColumns(380)).toBe(5);
    expect(bubbleColumns(100)).toBe(1);
  });

  it('never overlaps two bubbles of the same row', () => {
    const board = 358;
    const cols = bubbleColumns(board);
    const xs = Array.from({ length: cols }, (_, i) => bubbleSlot(i, board).x).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(BUBBLE_SIZE);
  });

  it('keeps every bubble inside the board', () => {
    const board = 358;
    for (let i = 0; i < 16; i++) {
      const slot = bubbleSlot(i, board);
      expect(slot.x).toBeGreaterThanOrEqual(0);
      expect(slot.x + BUBBLE_SIZE).toBeLessThanOrEqual(board);
    }
  });

  it('wraps to a new row once the columns are used up', () => {
    const board = 358;
    const cols = bubbleColumns(board);
    expect(bubbleSlot(0, board).row).toBe(0);
    expect(bubbleSlot(cols - 1, board).row).toBe(0);
    expect(bubbleSlot(cols, board).row).toBe(1);
    expect(bubbleSlot(cols * 2, board).row).toBe(2);
    expect(bubbleSlot(cols, board).x).toBe(bubbleSlot(0, board).x);
  });
});
