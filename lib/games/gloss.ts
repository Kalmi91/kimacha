// Meaning-resolution for ANY token a game shows, the other
// half of the user's set-in-stone criterion: "either I have already
// learned it, or if it is new, its meaning is shown, or I can tap
// it and it shows". components/games/GlossText.tsx renders what this module
// resolves, it never looks anything up itself.

import { findDeSplitVerb } from '@/data/deWords';
import { findWordByText, normalizeWordToken, type WordEntry } from '@/data/words';
import { detachedPrefixes } from '@/lib/knownSentence';

export interface GlossInfo {
  wordId?: number; // absent for an authored-content override (proper nouns etc.)
  learned: string;
  native: string;
  // TRUE = not yet in the caller's "known" set (dotted underline in the UI).
  // A token resolved purely from an override is always treated as new: it is
  // by definition outside the learner's practiced vocabulary.
  isNew: boolean;
}

interface ResolveGlossOptions {
  learnedLang: string;
  nativeLang: string;
  // word ids the player already knows (e.g. a PoolEntry list's non-new ids).
  // Omit to treat every corpus match as "new" (safe default: over-gloss, never
  // under-gloss).
  knownWordIds?: ReadonlySet<number>;
  // Authored per-item glosses for words outside the shared corpus (story
  // "newWords", myth "gloss", ...), keyed by normalizeWordToken(word) ->
  // { <nativeLang>: '...' }.
  overrides?: Record<string, Record<string, string>>;
}

export function resolveGloss(token: string, opts: ResolveGlossOptions): GlossInfo | undefined {
  const norm = normalizeWordToken(token);
  if (!norm) return undefined;

  const override = opts.overrides?.[norm];
  if (override) {
    const native = override[opts.nativeLang] ?? Object.values(override)[0] ?? '';
    return { learned: token, native, isNew: true };
  }

  const word = findWordByText(token, opts.learnedLang, opts.learnedLang);
  return word ? glossOf(word, token, opts) : undefined;
}

function glossOf(word: WordEntry, token: string, opts: ResolveGlossOptions): GlossInfo {
  const learned = word[opts.learnedLang];
  const native = word[opts.nativeLang];
  return {
    wordId: word.id,
    learned: typeof learned === 'string' ? learned : token,
    native: typeof native === 'string' ? native : '',
    isNew: !(opts.knownWordIds?.has(word.id) ?? false),
  };
}

// Builds the Map<token, GlossInfo> GlossText.tsx takes as input, one lookup
// per unique word in `text` (whitespace-split, punctuation forgiven by
// normalizeWordToken like the rest of the tap-to-spell machinery).
export function buildGlossMap(text: string, opts: ResolveGlossOptions): Map<string, GlossInfo> {
  const map = new Map<string, GlossInfo>();
  for (const raw of text.split(/\s+/)) {
    const norm = normalizeWordToken(raw);
    if (!norm || map.has(norm)) continue;
    const info = resolveGloss(raw, opts);
    if (info) map.set(norm, info);
  }
  if (opts.learnedLang === 'de') glossSeparableVerbs(text, map, opts);
  return map;
}

// "Ich stehe um sieben Uhr auf": a German verb splits, and neither half means anything alone. When a finite form and the prefix
// that closes the clause make a separable verb of the deck, both words show that verb ("aufstehen"), not "stehen" and "auf".
// The lesson's own glossary still wins (an override stays as it is).
function glossSeparableVerbs(text: string, map: Map<string, GlossInfo>, opts: ResolveGlossOptions): void {
  const prefixes = detachedPrefixes(text);
  if (prefixes.size === 0) return;
  const tokens = [...new Set(text.split(/\s+/).map((raw) => normalizeWordToken(raw)).filter(Boolean))];
  for (const form of tokens) {
    for (const prefix of prefixes) {
      if (prefix === form || opts.overrides?.[form] || opts.overrides?.[prefix]) continue;
      const verb = findDeSplitVerb(form, prefix);
      if (!verb) continue;
      map.set(form, glossOf(verb, form, opts));
      map.set(prefix, glossOf(verb, prefix, opts));
    }
  }
}
