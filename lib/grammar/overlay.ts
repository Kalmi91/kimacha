// The Hungarian and German grammar texts live in sidecar files (data/games/grammar-hu/<course>/<lesson>.json and
// data/games/grammar-de/<course>/<lesson>.json), one flat object per lesson: { "<exact en text>": "<translation>" }.
// The lesson JSON is not rewritten; when a lesson is loaded (lib/games/content/{es,en,hu}.ts) `withOverlay` lays the
// sidecar over it as the optional `hu` / `de` of every Lang4, so a display that does `field[contentLang] ?? field.en`
// picks it up. Both overlays can sit on the same lesson (a Hungarian and a German learner share the loaded lesson).
// (Keep this file import-free except for types: scripts/grammar-*-check.mjs load it through importTs.)
import type { GrammarIndexEntry } from '@/lib/games/content';

/** The learner languages that have an overlay next to the two authored ones (en, es). */
export type OverlayLang = 'hu' | 'de';

export const OVERLAY_LANGS: readonly OverlayLang[] = ['hu', 'de'];

export type OverlayMap = Readonly<Record<string, string>>;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * A Lang4 is an object whose keys are exactly `en` and `es` (strings). A `hu` / `de` that an earlier pass added is
 * allowed too, so the walk is the same on a lesson that already has an overlay.
 */
function isLang4(v: Record<string, unknown>): boolean {
  if (typeof v.en !== 'string' || typeof v.es !== 'string') return false;
  return Object.keys(v).every((k) => k === 'en' || k === 'es' || ((k === 'hu' || k === 'de') && typeof v[k] === 'string'));
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

/** A copy of the lesson with `lang` set on every Lang4 that the sidecar has an entry for (the input is not changed). */
export function withOverlay<T>(lesson: T, lang: OverlayLang, map: OverlayMap): T {
  return mapLang4(lesson, (l4) =>
    Object.prototype.hasOwnProperty.call(map, l4.en as string) ? { ...l4, [lang]: map[l4.en as string] } : l4,
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

/** A syllabus unit or topic title (a plain string) or title + blurb, by id (data/games/grammar-<lang>/syllabus.json). */
export type OverlayTitles = Readonly<Record<string, string | { title: string; blurb?: string }>>;

/** The syllabus units or topics with `lang` laid over `title` (and `blurb`, where the topic has one); an id without an entry stays as it is. */
export function withOverlayTitles<T extends { id: string; title: Record<string, string>; blurb?: Record<string, string> }>(
  entries: T[],
  lang: OverlayLang,
  titles: OverlayTitles,
): T[] {
  return entries.map((e) => {
    const own = titles[e.id];
    if (own === undefined) return e;
    const title = typeof own === 'string' ? own : own.title;
    const blurb = typeof own === 'string' ? undefined : own.blurb;
    return {
      ...e,
      title: { ...e.title, [lang]: title },
      ...(blurb !== undefined && e.blurb ? { blurb: { ...e.blurb, [lang]: blurb } } : {}),
    };
  });
}

/** data/games/grammar-<lang>/syllabus.json: unit and topic titles per course (the `hu` course section is optional, e.g. German titles for the Hungarian course). */
export interface OverlaySyllabus {
  es: { units: OverlayTitles; topics: OverlayTitles };
  en: { units: OverlayTitles; topics: OverlayTitles };
  hu?: { units: OverlayTitles; topics: OverlayTitles };
}

/** One overlay language with its lazy sidecars (topic id -> the sidecar's loader), as the generated `<course>.<lang>.index.ts` files export them. */
export interface OverlayLayer {
  lang: OverlayLang;
  sidecars: Record<string, () => OverlayMap>;
}

/** The lesson registry with the overlays applied inside each `load()` (lessons without a sidecar in a layer stay as they are there). */
export function withOverlayIndex(index: GrammarIndexEntry[], layers: OverlayLayer[]): GrammarIndexEntry[] {
  return index.map((entry) => {
    const own = layers.filter((layer) => layer.sidecars[entry.id]);
    if (own.length === 0) return entry;
    return {
      id: entry.id,
      load: () => own.reduce((lesson, layer) => withOverlay(lesson, layer.lang, layer.sidecars[entry.id]()), entry.load()),
    };
  });
}
