// GAMES.md 3.2 (F0): meaning-resolution for ANY token a game shows, the other
// half of the user's kőbe vésett kritérium (0. szekció): "vagy amit már
// tanultam, vagy ami új, annak ki van írva a jelentése, vagy kattintani lehet
// rá és kiírja". components/games/GlossText.tsx renders what this module
// resolves, it never looks anything up itself.

import { findWordByText, normalizeWordToken } from '@/data/words';

export interface GlossInfo {
  wordId?: number; // absent for an authored-content override (proper nouns etc.)
  learned: string;
  native: string;
  // TRUE = not yet in the caller's "known" set (pöttyözött aláhúzás a UI-ban).
  // A token resolved purely from an override is always treated as new: it is
  // by definition outside the learner's practiced vocabulary.
  isNew: boolean;
}

export interface ResolveGlossOptions {
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
  if (!word) return undefined;
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
// normalizeWordToken like the rest of the tap-to-spell machinery, FB150).
export function buildGlossMap(text: string, opts: ResolveGlossOptions): Map<string, GlossInfo> {
  const map = new Map<string, GlossInfo>();
  for (const raw of text.split(/\s+/)) {
    const norm = normalizeWordToken(raw);
    if (!norm || map.has(norm)) continue;
    const info = resolveGloss(raw, opts);
    if (info) map.set(norm, info);
  }
  return map;
}
