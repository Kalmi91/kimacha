// Dragging a placed tile to another place in the built sentence (FB537, "drag the words, so a wrong first word or the
// order can be fixed"; components/EasySentenceCard.tsx). Pure: where a tile let go lands, and the reordered row.

/** A placed tile's box in the row (onLayout: relative to the row). */
export interface TileFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The new index of the tile at `from`, moved by (dx, dy): the tile under its centre, else the nearest one (a row away
 * counts more than a tile away, so a short drag stays on its row). No frames (not laid out yet) = it stays.
 */
export function dropIndex(frames: readonly (TileFrame | undefined)[], from: number, dx: number, dy: number): number {
  const own = frames[from];
  if (!own) return from;
  const px = own.x + own.width / 2 + dx;
  const py = own.y + own.height / 2 + dy;
  let best = from;
  let bestDist = Infinity;
  frames.forEach((f, i) => {
    if (!f) return;
    if (px >= f.x && px <= f.x + f.width && py >= f.y && py <= f.y + f.height) {
      best = i;
      bestDist = -1;
      return;
    }
    if (bestDist < 0) return;
    const dist = Math.abs(px - (f.x + f.width / 2)) + 3 * Math.abs(py - (f.y + f.height / 2));
    if (dist < bestDist) {
      best = i;
      bestDist = dist;
    }
  });
  return best;
}

/** `items` with the one at `from` moved to `to` (the others close up). */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= items.length) return [...items];
  const rest = items.filter((_, i) => i !== from);
  rest.splice(Math.max(0, Math.min(to, rest.length)), 0, items[from]);
  return rest;
}
