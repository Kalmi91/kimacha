// PLAN-fb0923 8. lépés (FB365-369): A1 mondat-lánc sorrend + kapu. A
// data/pcic/<szint>-build.json (jelenleg csak A1) mondatonként adja a
// tagjait (a mondat szavaira mutató PCIC-tétel-id-ket) és a TELJES
// mondatokon az elé beszúrandó egyszerű "bridge" mondatok id-jét.
//
// Ez a modul csak a pickSm2Session HÍVÁSA ELŐTT futó `newOrder` (a fájl-
// sorrendből épülő új-kártya lista) átrendezéséért felel:
//   1. minden lánc-taghoz tartozó tétel (akár új, akár régi, a fájlban
//      messze levő PCIC-kártya, pl. "aeropuerto" a 634. helyen) előre
//      kerül, hogy a tanuló előbb lássa a szavakat, mint a mondatot
//      (FB366: "elébb a tagok jöjjenek fel");
//   2. egy bridge vagy a teljes mondat csak akkor kerül be az új-kártya
//      sorba, ha MINDEN saját tagja már 'review' állapotú (legalább
//      egyszer kigraduált a tanulási lépésből, lásd lib/sm2.ts);
//   3. a láncon kívüli tételek megtartják az eredeti egymáshoz képesti
//      sorrendjüket, a lánc-blokk UTÁN (rule: "a láncon kívüli új
//      tételek utána, eredeti sorrendben").
// A pickSm2Session (lib/sm2.ts) maga változatlan: a meglévő
// `existing.state !== 'new'` szűrése gondoskodik róla, hogy egy már
// bevezetett taget nem tesz be duplán újra, még ha ez a modul elé is
// tolja a newOrder-ben.
//
// "Menet közbeni felépülés" (a 8. lépés brief 2. pontja, teszt (c)):
// ez a függvény minden HÍVÁSKOR a `cards` PILLANATNYI állapotából
// számol, tehát ha egy tag review-ra graduál (akár ugyanazon a napon,
// két "good" után), a KÖVETKEZŐ pickSm2Session-hívás (fókusz-
// visszatérés, "+10 új szó" gomb) már a felépült bridge-et/mondatot
// adja. A brief csak ezt a két hívási pontot nevesíti (app/(tabs)/
// index.tsx load() és handleMoreNew()); nincs harmadik, az egyes
// értékelések utáni élő sor-beszúrás, mert a queue-t a session belül a
// lib/pcicSession.ts requeueAfterGrade-je mozgatja, nem pickSm2Session.

import type { Sm2Card } from './sm2';
import type { PcicLevel } from '@/data/pcic';
import a1Build from '../data/pcic/a1-build.json';

export interface ChainEntry {
  /** A mondat tartalmas szavaira mutató PCIC-tétel-id-k (funkciószó nélkül). */
  tags: string[];
  /** Csak a TELJES mondaton: az elé beszúrandó egyszerű mondatok id-i. */
  bridges?: string[];
}

export type ChainBuildMap = Record<string, ChainEntry>;

// Csak A1-en fut (PLAN-fb0923 7. lépés: "most még csak A1-be csináljuk");
// A2/B1/B2-nek nincs build.json-ja, ott applyChainOrder no-op.
const BUILD_BY_LEVEL: Partial<Record<PcicLevel, ChainBuildMap>> = {
  A1: a1Build as ChainBuildMap,
};

function isReview(cardsById: Map<string, Sm2Card>, id: string): boolean {
  return cardsById.get(id)?.state === 'review';
}

/** Igaz, ha `id` nem lánc-tétel, VAGY lánc-tétel és minden tagja tudott. */
function chainSentenceReady(build: ChainBuildMap, cardsById: Map<string, Sm2Card>, id: string): boolean {
  const entry = build[id];
  if (!entry) return true;
  return entry.tags.every((tagId) => isReview(cardsById, tagId));
}

/**
 * A `newOrder` (fájl-sorrendből épülő új-kártya lista) átrendezése a
 * mondat-láncok szerint. Mondatonként (a célmondat file-sorrendje szerint
 * haladva): a még nem húzott tagok előre, utána a bridge-ek (a saját
 * tagjaikkal együtt), utána a teljes mondat, DE egy bridge vagy a teljes
 * mondat csak akkor kerül be, ha a kapuja (chainSentenceReady) átenged;
 * amíg nem, egyszerűen kimarad ebből a hívásból (nem introducálódik).
 * A láncon kívüli tételek a végén, változatlan egymáshoz képesti
 * sorrendben.
 */
export function applyChainOrder(newOrder: string[], cards: Sm2Card[], level: PcicLevel): string[] {
  const build = BUILD_BY_LEVEL[level];
  if (!build || Object.keys(build).length === 0) return newOrder;

  const cardsById = new Map(cards.map((c) => [c.itemId, c]));
  const positionOf = new Map(newOrder.map((id, i) => [id, i]));

  // A bridge-ek nem önálló láncindítók: a `bridges` tömbökben szereplő
  // id-k FÜGGŐek, a maradék build-kulcs (a nyolc célmondat) a "szülő",
  // a fájl-sorrendjük szerint dolgozzuk fel őket.
  const bridgeIds = new Set<string>();
  for (const entry of Object.values(build)) {
    for (const bridgeId of entry.bridges ?? []) bridgeIds.add(bridgeId);
  }
  const parents = Object.keys(build)
    .filter((id) => !bridgeIds.has(id))
    .sort((a, b) => (positionOf.get(a) ?? Infinity) - (positionOf.get(b) ?? Infinity));

  const pulled: string[] = [];
  const pulledSet = new Set<string>();
  const excluded = new Set<string>(); // kapun fennakadt bridge/mondat id-k

  const push = (id: string) => {
    if (pulledSet.has(id)) return;
    pulledSet.add(id);
    pulled.push(id);
  };

  const maybePushSentence = (id: string) => {
    if (chainSentenceReady(build, cardsById, id)) push(id);
    else excluded.add(id);
  };

  // Csak azokat a lánc-id-ket húzzuk be, amik ebben a `newOrder`-ben
  // ténylegesen szerepelnek (pl. tesztben egy leszűkített/mock korpusz):
  // egy build.json-beli id, ami nincs a hívó newOrder-jében, nem az ő
  // dolga (nem kap kártyát, nem torlaszolja el a sort ismeretlen id-vel).
  for (const parentId of parents) {
    if (!positionOf.has(parentId)) continue;
    const parent = build[parentId];
    for (const tagId of parent.tags) if (positionOf.has(tagId)) push(tagId);
    for (const bridgeId of parent.bridges ?? []) {
      if (!positionOf.has(bridgeId)) continue;
      const bridge = build[bridgeId];
      if (bridge) for (const tagId of bridge.tags) if (positionOf.has(tagId)) push(tagId);
      maybePushSentence(bridgeId);
    }
    maybePushSentence(parentId);
  }

  const rest = newOrder.filter((id) => !pulledSet.has(id) && !excluded.has(id));
  return [...pulled, ...rest];
}

// FB365-369, funkciószó-lista a mondat-lánc szó-lefedettség auditjához
// (lib/__tests__/pcicChainCoverage.test.ts, észak-csillag 4. pont: soha
// nincs mondat ismeretlen szóval): névelők, alap-elöljárók, kötőszó,
// birtokos névmások, tagadás, és a ser/estar jelen idejű alakja (alap-
// nyelvtan, nem PCIC-szókincs; a 7. lépés jóváhagyott "El piso es
// grande." bridge-példája is enélkül a feltevés nélkül nem menne át).
// BŐVÍTENDŐ, ha egy újabb mondat-lánc újabb funkciószót hoz be.
export const CHAIN_FUNCTION_WORDS_ES = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'en', 'de', 'a', 'y', 'mi', 'tu', 'su', 'no',
  'es', 'son', 'está', 'están', 'soy', 'eres', 'somos', 'estoy', 'estamos',
]);
