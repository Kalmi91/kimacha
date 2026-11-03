// The Hungarian names of the generic overlay (lib/grammar/overlay.ts): the Hungarian sidecars
// (data/games/grammar-hu/<course>/<lesson>.json) are laid over a lesson as the optional `hu` of every Lang4.
import type { GrammarIndexEntry } from '@/lib/games/content';
import {
  lang4Keys,
  withOverlay,
  withOverlayIndex,
  withOverlayTitles,
  type OverlayMap,
  type OverlayTitles,
} from './overlay';

export { lang4Keys };

export type HuMap = OverlayMap;

/** A copy of the lesson with `hu` set on every Lang4 that the sidecar has an entry for (the input is not changed). */
export function withHu<T>(lesson: T, map: HuMap): T {
  return withOverlay(lesson, 'hu', map);
}

/** A syllabus unit or topic title (a plain string) or title + blurb, by id (data/games/grammar-hu/syllabus.json). */
export type HuTitles = OverlayTitles;

/** The syllabus units or topics with `hu` laid over `title` (and `blurb`, where the topic has one); an id without an entry stays as it is. */
export function withHuTitles<T extends { id: string; title: Record<string, string>; blurb?: Record<string, string> }>(
  entries: T[],
  titles: HuTitles,
): T[] {
  return withOverlayTitles(entries, 'hu', titles);
}

/** The lesson registry with the Hungarian overlay applied inside each `load()` (lessons without a sidecar stay as they are). */
export function withHuIndex(index: GrammarIndexEntry[], sidecars: Record<string, () => HuMap>): GrammarIndexEntry[] {
  return withOverlayIndex(index, [{ lang: 'hu', sidecars }]);
}
