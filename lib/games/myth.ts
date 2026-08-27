// GAMES.md 4.13 (F4, myth): "Igaz vagy kamu?" round-building, mirrors
// grammarChoice.ts's separation of pure logic from the screen. A run is a
// seeded-shuffled slice of the enabled tracks' items (K26: all 4 tracks by
// default), capped at the chosen run length (10/20/undefined=endless, per the
// 4.13 "Beállítás" list).

import { shuffleArray } from '../shuffle';
import type { MythItem, MythTrack } from './content';

export function buildMythRound(
  items: MythItem[],
  tracks: MythTrack[],
  length: number | undefined,
  seed: number
): MythItem[] {
  const enabled = new Set(tracks);
  const pool = items.filter((i) => enabled.has(i.track));
  const shuffled = shuffleArray(pool, seed);
  return length === undefined ? shuffled : shuffled.slice(0, length);
}
