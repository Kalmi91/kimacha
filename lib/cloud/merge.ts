// The merge of two cloud payloads ({ v, store, resume }, lib/cloud/sync.ts) for two devices that each saved progress the other
// has not seen. `local` is the state of this device, `remote` the one the server holds. Only the fields below have a rule;
// every other field of the store, and the resume keys, stay as `local` has them (what an upload did before the merge existed).
//   usageMinutes, dailyXp  per day, the larger number
//   pcicCards              per card, the one with the later lastReview (a tie keeps local); a card only one side has is kept
//   streak                 the whole row of the side with the larger longest_count (a tie keeps local)

type Entries = [string, unknown][];

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

function entriesOf(x: unknown): Entries | null {
  return Array.isArray(x) && x.every((e) => Array.isArray(e) && e.length === 2 && typeof e[0] === 'string') ? (x as Entries) : null;
}

// A serialized Map as the union of both sides, local order first; `pick` decides a key both sides have.
// A side whose field is not a serialized Map leaves the local field as it is.
function mergeEntries(local: unknown, remote: unknown, pick: (l: unknown, r: unknown) => unknown): unknown {
  const l = entriesOf(local);
  const r = entriesOf(remote);
  if (!l || !r) return local;
  const out = new Map(l);
  for (const [key, value] of r) out.set(key, out.has(key) ? pick(out.get(key), value) : value);
  return [...out];
}

const larger = (l: unknown, r: unknown): unknown => (typeof r === 'number' && (typeof l !== 'number' || r > l) ? r : l);

const reviewOf = (card: unknown): string => (isRecord(card) && typeof card.lastReview === 'string' ? card.lastReview : '');
const laterReview = (l: unknown, r: unknown): unknown => (reviewOf(r) > reviewOf(l) ? r : l);

const longestOf = (streak: unknown): number => (isRecord(streak) && typeof streak.longest_count === 'number' ? streak.longest_count : -1);
const longerStreak = (l: unknown, r: unknown): unknown => (longestOf(r) > longestOf(l) ? r : l);

function parseCloud(payload: string): { outer: Record<string, unknown>; store: Record<string, unknown> } | null {
  try {
    const outer: unknown = JSON.parse(payload);
    if (!isRecord(outer) || typeof outer.store !== 'string') return null;
    const store: unknown = JSON.parse(outer.store);
    return isRecord(store) ? { outer, store } : null;
  } catch {
    return null;
  }
}

/** The merged payload string; `local` itself when either side is not a readable cloud payload. */
export function mergeCloudPayloads(local: string, remote: string): string {
  const l = parseCloud(local);
  const r = parseCloud(remote);
  if (!l || !r) return local;
  const store = {
    ...l.store,
    streak: longerStreak(l.store.streak, r.store.streak),
    usageMinutes: mergeEntries(l.store.usageMinutes, r.store.usageMinutes, larger),
    dailyXp: mergeEntries(l.store.dailyXp, r.store.dailyXp, larger),
    pcicCards: mergeEntries(l.store.pcicCards, r.store.pcicCards, laterReview),
  };
  return JSON.stringify({ ...l.outer, store: JSON.stringify(store) });
}
