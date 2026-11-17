import { FORCED_PAIR, needsPairCorrection, supportedPairs } from '../languages';

// The SM-2 cards (pcic_cards, mistake_cards) used to be one shared set; since E123 every card belongs to a language
// pair. A card an older build wrote has no pair: it stays with the pair that was active at the update when that
// pair's target language is the card's own. Otherwise it goes to the known pair of the card's target language where the
// learner studied last: the pair whose Learn resume row ('learn' in game_progress of that pair, saved by 4.1.41 too,
// lib/learnResume.ts) has the latest `day`. With no such day on any candidate, or a tie, the newest known pair wins
// (the last in `known`, oldest first). The mistakes deck is always Spanish, so it follows the same rule with target es.

// The deck an id belongs to is told by its first letter (data/pcic.ts): o<order> es, e<id> en, h<id> hu, d<id> de.
const TARGET_BY_PREFIX: Record<string, string> = { o: 'es', e: 'en', h: 'hu', d: 'de' };
export const CARD_ID_PREFIXES = Object.keys(TARGET_BY_PREFIX);

// The Learn resume row (lib/resumeStore.ts: game RESUME_GAME_ID of lib/resumeRoute.ts, item 'learn'); the strings are
// copied here because that module pulls in react-native, which a migration must not.
export const LEARN_RESUME_GAME_ID = 'app-resume';
export const LEARN_RESUME_ITEM_ID = 'learn';

// The `day` of a Learn resume value (an object, or its JSON text as a backup / the native column holds it); null if none.
export function learnDayOf(value: unknown): string | null {
  let v = value;
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  const day = typeof v === 'object' && v !== null ? (v as { day?: unknown }).day : undefined;
  return typeof day === 'string' && day !== '' ? day : null;
}

// pair -> the last day the Learn tab ran in it (only pairs that have one).
export type LearnDays = Readonly<Record<string, string>>;

// From backup game_progress rows ({ pair, game_id, item_id, data_json }).
export function learnDaysFromRows(rows: readonly any[] | undefined): LearnDays {
  const out: Record<string, string> = {};
  for (const r of rows ?? []) {
    if (r?.game_id !== LEARN_RESUME_GAME_ID || r?.item_id !== LEARN_RESUME_ITEM_ID || typeof r.pair !== 'string') continue;
    const day = learnDayOf(r.data_json);
    if (day) out[r.pair] = day;
  }
  return out;
}

// From a web state's gameProgress entries (key `${pair}:${gameId}` -> [itemId, { state, data }][]). The web build keeps its
// own Learn resume in localStorage, one value for the whole browser (not per pair), so only a state that came from a
// native backup carries per-pair days here.
export function learnDaysFromWebProgress(entries: unknown): LearnDays {
  const out: Record<string, string> = {};
  if (!Array.isArray(entries)) return out;
  for (const e of entries) {
    if (!Array.isArray(e) || typeof e[0] !== 'string' || !Array.isArray(e[1])) continue;
    const sep = e[0].lastIndexOf(':');
    if (e[0].slice(sep + 1) !== LEARN_RESUME_GAME_ID) continue;
    const item = e[1].find((i: unknown) => Array.isArray(i) && i[0] === LEARN_RESUME_ITEM_ID);
    const day = learnDayOf(Array.isArray(item) ? (item[1] as { data?: unknown } | null)?.data : null);
    if (day) out[e[0].slice(0, sep)] = day;
  }
  return out;
}

export const targetOfPair = (pair: string): string => pair.slice(pair.indexOf('-') + 1);

export function targetOfCardId(itemId: string): string | null {
  return TARGET_BY_PREFIX[itemId.charAt(0)] ?? null;
}

// `known`: the pairs the old data knows (oldest first); `days`: their Learn days. A card with no known pair of its
// target goes to the supported pair of that target that shares the active source, else to the first supported pair of it.
export function legacyCardPair(target: string | null, active: string, known: readonly string[], days: LearnDays = {}): string {
  if (target === null || targetOfPair(active) === target) return active;
  const same = known.filter((p) => targetOfPair(p) === target);
  if (same.length > 0) {
    const latest = same.reduce((m, p) => (days[p] !== undefined && days[p] > m ? days[p] : m), '');
    const tied = latest === '' ? same : same.filter((p) => days[p] === latest);
    return tied[tied.length - 1];
  }
  const source = active.slice(0, active.indexOf('-'));
  const pair = supportedPairs.find(([s, t]) => t === target && s === source) ?? supportedPairs.find(([, t]) => t === target);
  return pair ? `${pair[0]}-${pair[1]}` : active;
}

// The pair of each card-id prefix, for a set-based migration.
export function legacyPairByPrefix(active: string, known: readonly string[], days: LearnDays = {}): Record<string, string> {
  return Object.fromEntries(CARD_ID_PREFIXES.map((p) => [p, legacyCardPair(TARGET_BY_PREFIX[p], active, known, days)]));
}

// Web / backup rows: the pair of a card that has none.
export function pairOfLegacyCard(itemId: string, active: string, known: readonly string[], forcedTarget?: string, days: LearnDays = {}): string {
  return legacyCardPair(forcedTarget ?? targetOfCardId(itemId), active, known, days);
}

// The active pair a stored onboarding row names; a missing or drifted one is the forced default (as at startup).
export function activePairOf(ob: { source?: unknown; target?: unknown } | null | undefined): string {
  return ob && typeof ob.source === 'string' && typeof ob.target === 'string' && !needsPairCorrection({ source: ob.source, target: ob.target })
    ? `${ob.source}-${ob.target}`
    : `${FORCED_PAIR.source}-${FORCED_PAIR.target}`;
}

const parsePair = (pair: string) => ({ source: pair.slice(0, pair.indexOf('-')), target: targetOfPair(pair) });

// A backup's card rows without a pair (schema v1/v2, the old shared set) get one: the pair the backup's own onboarding
// names (a drifted one is forced like DbCore.importAll does), else `current`. Rows that carry a supported pair stay as they are (one of a drifted pair is treated like an unpaired one, so the restore loses none).
export function pairBackupCards<T extends Record<string, any>>(tables: T, current: string): T {
  const ob = tables.onboarding?.[0];
  const active = ob ? (needsPairCorrection(ob) ? `${FORCED_PAIR.source}-${FORCED_PAIR.target}` : `${ob.source}-${ob.target}`) : current;
  const known = [...new Set<string>([...(tables.learn_settings ?? []), ...(tables.user_level ?? [])].map((r: any) => r.pair))];
  const days = learnDaysFromRows(tables.game_progress);
  const fix = (rows: any[] | undefined, forcedTarget?: string) =>
    rows?.map((r) => (typeof r.pair === 'string' && !needsPairCorrection(parsePair(r.pair)) ? r : { ...r, pair: pairOfLegacyCard(r.item_id, active, known, forcedTarget, days) }));
  return { ...tables, pcic_cards: fix(tables.pcic_cards), mistake_cards: fix(tables.mistake_cards, 'es') };
}

// Web state key of a card: `${pair}|${itemId}` (a pair holds no '|').
export const cardKey = (pair: string, itemId: string): string => `${pair}|${itemId}`;
const PAIR_KEY = /^([a-z]{2}-[a-z]{2})\|/;
export const pairOfKey = (key: string): string | null => PAIR_KEY.exec(key)?.[1] ?? null;
export const itemIdOfKey = (key: string): string => key.slice(key.indexOf('|') + 1);

// Gives every key of a serialized card Map without a pair (old state) the pair it belongs to.
// `forcedTarget`: the deck's one target (mistake cards are always Spanish).
export function pairLegacyEntries<T>(entries: [string, T][], active: string, known: readonly string[], forcedTarget?: string, days: LearnDays = {}): [string, T][] {
  return entries.map(([key, value]) => (pairOfKey(key) !== null ? [key, value] : [cardKey(pairOfLegacyCard(key, active, known, forcedTarget, days), key), value]));
}
