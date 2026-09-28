// FREQ-ORDER (PLAN-freq.md 2. lépés): kulcs- és rangoló logika a szókártyák
// FrequencyWords (hermitdave/FrequencyWords es_50k, CC BY-SA 4.0) szerinti,
// szinten belüli rendezéséhez. Ugyanez a logika duplikálva fut a
// scripts/freq-order.mjs-ben (.mjs nem importál TS-t build nélkül, keep in
// sync); a TS oldalt a lib/__tests__/freqOrder.test.ts fedi.

const ARTICLES = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas']);
const PRONOUNS = new Set([
  'yo', 'tú', 'él', 'ella', 'usted',
  'nosotros', 'nosotras', 'vosotros', 'vosotras', 'ellos', 'ellas', 'ustedes',
]);

export interface FreqIndex {
  exact: Map<string, number>;
  folded: Map<string, number>;
}

/** Ékezetek levágása NFD-bontással (á -> a, ñ -> n, ...), az ékezet-hajtogatott egyezéshez. */
export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Az `es` mező tokenjei: a zárójeles rész (tartalmával együtt) ki, kisbetű,
 * írásjel ki, szóköz/`/` mentén vágva, névelő és alanyi névmás nélkül, DE
 * csak akkor esik ki egy névelő/névmás, ha marad más token is (különben a
 * szűretlen tokenek maradnak, pl. önmagában `yo` vagy `un/una`).
 */
export function tokenizeEs(es: string): string[] {
  const withoutParens = es.replace(/\([^)]*\)/g, '');
  const cleaned = withoutParens.toLowerCase().replace(/[¿?¡!.,;:"()]/g, '');
  const rawTokens = cleaned
    .split(/[\s/]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const filtered = rawTokens.filter((t) => !ARTICLES.has(t) && !PRONOUNS.has(t));
  return filtered.length > 0 ? filtered : rawTokens;
}

/** `es_50k.txt` ("szó darabszám" soronként) -> pontos és ékezet-hajtogatott rang-index, 1-től. */
export function parseFreqList(text: string): FreqIndex {
  const exact = new Map<string, number>();
  const folded = new Map<string, number>();
  let rank = 0;
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const spaceIdx = trimmed.indexOf(' ');
    const word = (spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx)).toLowerCase();
    if (!word) continue;
    rank += 1;
    if (!exact.has(word)) exact.set(word, rank);
    const fold = stripAccents(word);
    const best = folded.get(fold);
    if (best === undefined || rank < best) folded.set(fold, rank);
  }
  return { exact, folded };
}

/** Egy token rangja: pontos egyezés, különben ékezet-hajtogatott egyezés (legjobb rang), különben Infinity. */
export function rankOfToken(token: string, index: FreqIndex): number {
  const exact = index.exact.get(token);
  if (exact !== undefined) return exact;
  const folded = index.folded.get(stripAccents(token));
  return folded !== undefined ? folded : Infinity;
}

/** Kártya rangja = a tokenek közül a legrosszabb (legnagyobb) rang. */
export function cardRank(es: string, index: FreqIndex): number {
  const tokens = tokenizeEs(es);
  if (tokens.length === 0) return Infinity;
  let worst = 0;
  for (const token of tokens) worst = Math.max(worst, rankOfToken(token, index));
  return worst;
}

/** Szinten belüli stabil rendezés rang szerint növekvően; az Infinity rangúak a végén, eredeti sorrendjükben. */
export function sortByFreqRank<T extends { es: string }>(cards: T[], index: FreqIndex): T[] {
  return cards
    .map((card, i) => ({ card, i, rank: cardRank(card.es, index) }))
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .map((entry) => entry.card);
}
