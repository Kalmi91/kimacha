// PLAN-fb0924 7a. lépés (FB396, D3): tiszta normalizálás + szint-döntés a PCIC
// szó szint-igazításhoz - egy szó a nehézségének megfelelő PCIC-szinten
// legyen, a nehézség forrása az app saját, gyakoriság-alapú szókorpusza
// (data/words/a0.json..b1.json). scripts/pcic-level-fit.mjs ugyanezt a
// logikát futtatja plain JS-ben (a JSON-fájlokat olvassa/írja, ahol egy TS
// modult nem lehet közvetlenül importálni node-ból build nélkül); a döntés
// maga itt van egységben tesztelve. 7b (PLAN-fb0924) ugyanezt a normalizálást
// újrahasználja a szintek közti duplikátumok egyeztetésekor.

export type CorpusLevel = 'a0' | 'a1' | 'a2' | 'b1';
export type PcicLevelLower = 'a1' | 'a2' | 'b1' | 'b2';

const CORPUS_RANK: Record<CorpusLevel, number> = { a0: 0, a1: 1, a2: 2, b1: 3 };
const PCIC_RANK: Record<PcicLevelLower, number> = { a1: 1, a2: 2, b1: 3, b2: 4 };
// A0 nincs PCIC-szinten (a PCIC A1-től indul), ezért a legalacsonyabb
// PCIC-padló A1: egy A0-korpuszú szó legfeljebb A1-re mozog, nem lejjebb.
const CLAMP_TO_PCIC_FLOOR: Record<CorpusLevel, PcicLevelLower> = { a0: 'a1', a1: 'a1', a2: 'a2', b1: 'b1' };

/**
 * kisbetű, zárójeles rész le (glossza, opcionális betű és reflexív/
 * infinitivus jelölés mind ez a minta: "quizá(s)", "(super)mercado",
 * "celebrar(se)", "tiene (tener)"), szótári névelő le (el/la/los/las).
 */
export function normalizeForLevelFit(es: string): string {
  let s = es.toLowerCase();
  s = s.replace(/\([^)]*\)/g, '');
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(/^(el|la|los|las)\s+/, '');
  return s.trim();
}

/** "/" mentén szétválasztott alternatív alakok (pl. "el libro / los libros",
 *  "rubio/rubia") külön normalizálva, üres darab nélkül. */
export function formsOf(es: string): string[] {
  return es
    .split('/')
    .map((part) => normalizeForLevelFit(part))
    .filter(Boolean);
}

/** Egy szó (bármelyik alakja) legalacsonyabb szintje a korpusz-indexben, vagy
 *  null, ha egyik alakja sincs a korpuszban. */
export function bestCorpusLevel(es: string, corpusIndex: Map<string, CorpusLevel>): CorpusLevel | null {
  let best: CorpusLevel | null = null;
  for (const form of formsOf(es)) {
    const cl = corpusIndex.get(form);
    if (cl && (best === null || CORPUS_RANK[cl] < CORPUS_RANK[best])) best = cl;
  }
  return best;
}

/**
 * Szabály: új szint = min(jelenlegi PCIC-szint, korpusz-szint A1-padlóval),
 * csak lefelé mozgat. Ha a szó nincs a korpuszban (`corpusLevel === null`),
 * marad a jelenlegi szinten.
 */
export function targetPcicLevel(currentLevel: PcicLevelLower, corpusLevel: CorpusLevel | null): PcicLevelLower {
  if (corpusLevel === null) return currentLevel;
  const clamped = CLAMP_TO_PCIC_FLOOR[corpusLevel];
  return PCIC_RANK[clamped] < PCIC_RANK[currentLevel] ? clamped : currentLevel;
}

/** A szó-korpusz minden szintjének `es` mezőiből épített index (legalacsonyabb
 *  szint nyer, ha egy alak több szinten is szerepelne). */
export function buildCorpusLevelIndex(corpusByLevel: Record<CorpusLevel, { es: string }[]>): Map<string, CorpusLevel> {
  const map = new Map<string, CorpusLevel>();
  const levels: CorpusLevel[] = ['a0', 'a1', 'a2', 'b1'];
  for (const lvl of levels) {
    for (const w of corpusByLevel[lvl] ?? []) {
      for (const form of formsOf(w.es)) {
        const existing = map.get(form);
        if (!existing || CORPUS_RANK[existing] > CORPUS_RANK[lvl]) map.set(form, lvl);
      }
    }
  }
  return map;
}
