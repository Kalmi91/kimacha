// FB537: a placed tile dragged to another place (lib/tileDrag.ts).
import { dropIndex, moveItem, type TileFrame } from '../tileDrag';

// Two rows: tiles 0-2 on the first (y 0), 3-4 on the second (y 50); each 60 wide, 40 high, 8 apart.
const tile = (x: number, y: number): TileFrame => ({ x, y, width: 60, height: 40 });
const ROW: TileFrame[] = [tile(0, 0), tile(68, 0), tile(136, 0), tile(0, 50), tile(68, 50)];

describe('dropIndex', () => {
  it('lands on the tile under the dragged tile\'s centre', () => {
    expect(dropIndex(ROW, 0, 136, 0)).toBe(2); // the first word dragged onto the third
    expect(dropIndex(ROW, 2, -136, 0)).toBe(0);
    expect(dropIndex(ROW, 0, 68, 50)).toBe(4); // to the next row
  });

  it('a small move stays on its place', () => {
    expect(dropIndex(ROW, 1, 10, 5)).toBe(1);
  });

  it('in a gap or past the end: the nearest tile, the same row first', () => {
    expect(dropIndex(ROW, 0, 300, 0)).toBe(2); // far right of the first row
    expect(dropIndex(ROW, 3, 200, 0)).toBe(4); // far right of the second row
  });

  it('a tile not laid out yet stays', () => {
    expect(dropIndex([undefined, tile(68, 0)], 0, 68, 0)).toBe(0);
  });
});

describe('moveItem', () => {
  it('moves one item and closes up the rest', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(moveItem(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c']);
  });

  it('a wrong first word fixed: the right one, added last, dragged to the front', () => {
    expect(moveItem(['libro', 'y', 'la', 'mesa', 'el'], 4, 0)).toEqual(['el', 'libro', 'y', 'la', 'mesa']);
  });
});
