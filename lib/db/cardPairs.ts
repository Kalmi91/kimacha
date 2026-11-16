import { FORCED_PAIR, needsPairCorrection, supportedPairs } from '../languages';

// The SM-2 cards (pcic_cards, mistake_cards) used to be one shared set; since E123 every card belongs to a language
// pair. A card an older build wrote has no pair: it stays with the pair that was active at the update when that
// pair's target language is the card's own, otherwise with the most recently set-up pair of the card's target
// language (no per-pair "last used" time is stored, so the newest known pair stands in for it).

// The deck an id belongs to is told by its first letter (data/pcic.ts): o<order> es, e<id> en, h<id> hu, d<id> de.
const TARGET_BY_PREFIX: Record<string, string> = { o: 'es', e: 'en', h: 'hu', d: 'de' };
export const CARD_ID_PREFIXES = Object.keys(TARGET_BY_PREFIX);

export const targetOfPair = (pair: string): string => pair.slice(pair.indexOf('-') + 1);

export function targetOfCardId(itemId: string): string | null {
  return TARGET_BY_PREFIX[itemId.charAt(0)] ?? null;
}

// `known`: the pairs the old data knows (oldest first). A card with no pair of its target yet goes to the
// supported pair of that target that shares the active source, else to the first supported pair of the target.
export function legacyCardPair(target: string | null, active: string, known: readonly string[]): string {
  if (target === null || targetOfPair(active) === target) return active;
  const same = known.filter((p) => targetOfPair(p) === target);
  if (same.length > 0) return same[same.length - 1];
  const source = active.slice(0, active.indexOf('-'));
  const pair = supportedPairs.find(([s, t]) => t === target && s === source) ?? supportedPairs.find(([, t]) => t === target);
  return pair ? `${pair[0]}-${pair[1]}` : active;
}

// The pair of each card-id prefix, for a set-based migration.
export function legacyPairByPrefix(active: string, known: readonly string[]): Record<string, string> {
  return Object.fromEntries(CARD_ID_PREFIXES.map((p) => [p, legacyCardPair(TARGET_BY_PREFIX[p], active, known)]));
}

// Web / backup rows: the pair of a card that has none.
export function pairOfLegacyCard(itemId: string, active: string, known: readonly string[], forcedTarget?: string): string {
  return legacyCardPair(forcedTarget ?? targetOfCardId(itemId), active, known);
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
  const fix = (rows: any[] | undefined, forcedTarget?: string) =>
    rows?.map((r) => (typeof r.pair === 'string' && !needsPairCorrection(parsePair(r.pair)) ? r : { ...r, pair: pairOfLegacyCard(r.item_id, active, known, forcedTarget) }));
  return { ...tables, pcic_cards: fix(tables.pcic_cards), mistake_cards: fix(tables.mistake_cards, 'es') };
}

// Web state key of a card: `${pair}|${itemId}` (a pair holds no '|').
export const cardKey = (pair: string, itemId: string): string => `${pair}|${itemId}`;
const PAIR_KEY = /^([a-z]{2}-[a-z]{2})\|/;
export const pairOfKey = (key: string): string | null => PAIR_KEY.exec(key)?.[1] ?? null;
export const itemIdOfKey = (key: string): string => key.slice(key.indexOf('|') + 1);

// Gives every key of a serialized card Map without a pair (old state) the pair it belongs to.
// `forcedTarget`: the deck's one target (mistake cards are always Spanish).
export function pairLegacyEntries<T>(entries: [string, T][], active: string, known: readonly string[], forcedTarget?: string): [string, T][] {
  return entries.map(([key, value]) => (pairOfKey(key) !== null ? [key, value] : [cardKey(pairOfLegacyCard(key, active, known, forcedTarget), key), value]));
}
