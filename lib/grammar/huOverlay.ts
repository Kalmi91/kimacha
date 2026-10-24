// The Hungarian grammar texts live in sidecar files (data/games/grammar-hu/<lang>/<lesson>.json), one flat
// object per lesson: { "<exact en text>": "<Hungarian text>" }. The lesson JSON is not rewritten; when a
// lesson is loaded (lib/games/content/{es,en}.ts) `withHu` lays the sidecar over it as the optional `hu` of
// every Lang4, so a display that does `field[contentLang] ?? field.en` picks it up.
// (Keep this file import-free except for types: scripts/grammar-hu-check.mjs loads it through importTs.)
import type { GrammarIndexEntry } from '@/lib/games/content';

export type HuMap = Readonly<Record<string, string>>;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * A Lang4 is an object whose keys are exactly `en` and `es` (strings). A `hu` that an earlier pass added is
 * allowed too, so the walk is the same on a lesson that already has the overlay.
 */
function isLang4(v: Record<string, unknown>): boolean {
  if (typeof v.en !== 'string' || typeof v.es !== 'string') return false;
  return Object.keys(v).every((k) => k === 'en' || k === 'es' || (k === 'hu' && typeof v.hu === 'string'));
}

/** A copy of `value` with `fn` applied to every Lang4 in it; the literal word pairs of a match item are left out. */
function mapLang4(value: unknown, fn: (l4: Record<string, unknown>) => Record<string, unknown>, literalPair = false): unknown {
  if (Array.isArray(value)) return value.map((v) => mapLang4(v, fn));
  if (!isRecord(value)) return value;
  // The literal word pairs of a match item ({es, en}, direct elements of an array under `pairs`) are not
  // explanatory text: they are copied as they are.
  if (isLang4(value)) return literalPair ? value : fn(value);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = Array.isArray(v) && k === 'pairs' ? v.map((e) => mapLang4(e, fn, true)) : mapLang4(v, fn);
  }
  return out;
}

/** A copy of the lesson with `hu` set on every Lang4 that the sidecar has an entry for (the input is not changed). */
export function withHu<T>(lesson: T, map: HuMap): T {
  return mapLang4(lesson, (l4) =>
    Object.prototype.hasOwnProperty.call(map, l4.en as string) ? { ...l4, hu: map[l4.en as string] } : l4,
  ) as T;
}

/** The `en` text (= the sidecar key) of every Lang4 in the lesson, in order, one entry per object. */
export function lang4Keys(lesson: unknown): string[] {
  const keys: string[] = [];
  mapLang4(lesson, (l4) => {
    keys.push(l4.en as string);
    return l4;
  });
  return keys;
}

/** A syllabus unit or topic title (a plain string) or title + blurb, by id (data/games/grammar-hu/syllabus.json). */
export type HuTitles = Readonly<Record<string, string | { title: string; blurb?: string }>>;

/** The syllabus units or topics with `hu` laid over `title` (and `blurb`, where the topic has one); an id without an entry stays as it is. */
export function withHuTitles<T extends { id: string; title: Record<string, string>; blurb?: Record<string, string> }>(
  entries: T[],
  titles: HuTitles,
): T[] {
  return entries.map((e) => {
    const hu = titles[e.id];
    if (hu === undefined) return e;
    const title = typeof hu === 'string' ? hu : hu.title;
    const blurb = typeof hu === 'string' ? undefined : hu.blurb;
    return {
      ...e,
      title: { ...e.title, hu: title },
      ...(blurb !== undefined && e.blurb ? { blurb: { ...e.blurb, hu: blurb } } : {}),
    };
  });
}

/** The lesson registry with the Hungarian overlay applied inside each `load()` (lessons without a sidecar stay as they are). */
export function withHuIndex(
  index: GrammarIndexEntry[],
  sidecars: Record<string, () => HuMap>,
): GrammarIndexEntry[] {
  return index.map((entry) => {
    const sidecar = sidecars[entry.id];
    return sidecar ? { id: entry.id, load: () => withHu(entry.load(), sidecar()) } : entry;
  });
}
