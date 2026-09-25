// PLAN-pcic 5. lépés: adat-betöltő a PCIC fülhöz. Csak import + típus +
// helper, az adat maga a data/pcic/*.json fájlokban él (K1 konvenció).
// PLAN-play 10. lépés: négy szint (A1/A2/B1/B2), a korábbi B1-only betöltés
// helyett. Az item id-k szint-előtaggal jönnek ("a1-...", "b1-...", ...), ez
// a haladás szintenkénti elkülönülésének is az alapja (lib/pcicLevels.ts).

import a1Raw from './pcic/a1-all.json';
import a1En from './pcic/a1-en.json';
import a1Sentences from './pcic/a1-sentences.json';
import a1Build from './pcic/a1-build.json';
import a2Raw from './pcic/a2-all.json';
import a2En from './pcic/a2-en.json';
import a2Sentences from './pcic/a2-sentences.json';
import b1Raw from './pcic/b1-all.json';
import b1En from './pcic/b1-en.json';
import b1Sentences from './pcic/b1-sentences.json';
import b2Raw from './pcic/b2-all.json';
import b2En from './pcic/b2-en.json';
import b2Sentences from './pcic/b2-sentences.json';
import type { Pos } from '@/lib/pcicPos';

export type PcicKind = 'word' | 'phrase' | 'sentence' | 'pattern';
export type PcicLevel = 'A1' | 'A2' | 'B1' | 'B2';

export const PCIC_LEVELS: PcicLevel[] = ['A1', 'A2', 'B1', 'B2'];

// PLAN-fb0924 8. lépés (FB394/396): "A1+"/"A2+" a mondat-arány kordában
// tartásához bevezetett VIRTUÁLIS szint - nincs saját adatfájljuk, a hozzájuk
// tartozó tételek fizikailag az A1/A2 fájlban élnek (id-jük, haladásuk
// változatlan), csak a szint-VÁLASZTÓBAN és a pakli-építésben jelennek meg
// külön "sorként" (lásd isPlusSentence + pcicItemsForViewLevel lent).
export type PcicViewLevel = PcicLevel | 'A1+' | 'A2+';
export const PCIC_VIEW_LEVELS: PcicViewLevel[] = ['A1', 'A1+', 'A2', 'A2+', 'B1', 'B2'];

// s1 (anki-ui-terv.html): a négy szint felirata a szint-választó lapon.
export const LEVEL_LABELS: Record<PcicViewLevel, string> = {
  A1: 'Beginner',
  A2: 'Elementary',
  B1: 'Intermediate',
  B2: 'Upper intermediate',
  'A1+': '+1 · sentences',
  'A2+': '+1 · sentences',
};

interface RawPcicItem {
  id: string;
  es: string;
  kind: PcicKind;
  source: string;
  section: string;
  headword?: string;
  order?: number;
  // FB361-362: kézzel felvitt szófaj a data/pcic/<szint>-all.json tételen,
  // ahol a lib/pcicPos.ts korpusz-egyezés/szabály nem ad találatot. A `Pos`
  // a korpusz WordPos-án felül `conj`/`prefix`/`suffix`-et is felvesz,
  // olyan PCIC-tételekre, amiknek a korpuszban nincs is megfelelője.
  pos?: Pos;
  // FB363: a PCIC `[Régió] szó` zárójeles nyelvjárás-jelölése, a zárójel
  // nélküli tartalom (pl. "Hispanoamérica", "México, Cuba y Venezuela").
  region?: string;
  // FB367: A1 spanyolországi/mexikói köznyelvi eltérés a mexikói alak
  // (pl. "departamento" a "piso" mellett).
  mx?: string;
}

export interface PcicItem {
  id: string;
  es: string;
  en: string;
  kind: PcicKind;
  section: string;
  order: number;
  pos?: Pos;
  region?: string;
  mx?: string;
  // PLAN-play 11. lépés: példamondat a korpuszból, csak ha van egyezés
  // (data/pcic/<szint>-sentences.json); a Check utáni felfedésen jelenik meg.
  exampleEs?: string;
  exampleEn?: string;
}

interface PcicSentence {
  es: string;
  en: string;
}

// A `pattern` kind (nyelvtani minta, nem szókincs-tétel) kimarad, és csak
// azok a tételek maradnak, amikhez van angol fordítás.
function buildItems(
  rawItems: RawPcicItem[],
  enById: Record<string, string>,
  sentenceById: Record<string, PcicSentence>
): PcicItem[] {
  return rawItems
    .map((item, index) => {
      const sentence = sentenceById[item.id];
      return {
        id: item.id,
        es: item.es,
        en: enById[item.id] ?? '',
        kind: item.kind,
        section: item.section,
        order: item.order ?? index,
        pos: item.pos,
        region: item.region,
        mx: item.mx,
        exampleEs: sentence?.es,
        exampleEn: sentence?.en,
      };
    })
    .filter((item) => item.kind !== 'pattern' && item.en.length > 0)
    .sort((a, b) => a.order - b.order);
}

const ITEMS_BY_LEVEL: Record<PcicLevel, PcicItem[]> = {
  A1: buildItems(a1Raw as RawPcicItem[], a1En as Record<string, string>, a1Sentences as Record<string, PcicSentence>),
  A2: buildItems(a2Raw as RawPcicItem[], a2En as Record<string, string>, a2Sentences as Record<string, PcicSentence>),
  B1: buildItems(b1Raw as RawPcicItem[], b1En as Record<string, string>, b1Sentences as Record<string, PcicSentence>),
  B2: buildItems(b2Raw as RawPcicItem[], b2En as Record<string, string>, b2Sentences as Record<string, PcicSentence>),
};

const ITEM_BY_ID = new Map<string, PcicItem>();
// PLAN-fb0924 7a. lépés (FB396, D3): a szint-igazítás egy szót a
// nehézségének megfelelő szint FÁJLJÁBA mozgat, az id-je változatlan marad
// (lib/pcicLevelMoves.ts, régi id -> új id). Az item TÉNYLEGES szintje innentől
// azt jelenti, MELYIK fájlban él, nem az id előtagját (lib/pcicLevels.ts
// matchesLevel ezt a térképet használja, id-előtagra csak akkor esik vissza,
// ha az id nincs a betöltött korpuszban, pl. teszt-fixture).
const LEVEL_BY_ID = new Map<string, PcicLevel>();
for (const level of PCIC_LEVELS) {
  for (const item of ITEMS_BY_LEVEL[level]) {
    ITEM_BY_ID.set(item.id, item);
    LEVEL_BY_ID.set(item.id, level);
  }
}

export function pcicItemsForLevel(level: PcicLevel): PcicItem[] {
  return ITEMS_BY_LEVEL[level];
}

export function findPcicItem(id: string): PcicItem | undefined {
  return ITEM_BY_ID.get(id);
}

/** A betöltött korpuszban élő item TÉNYLEGES szintje, vagy undefined, ha az
 *  id nincs a korpuszban. */
export function levelOfItem(id: string): PcicLevel | undefined {
  return LEVEL_BY_ID.get(id);
}

// PLAN-fb0924 8. lépés (FB394/396): a1-build.json TOP-LEVEL kulcsai a lánc
// mondatai (a szülő komplex mondat ÉS a bridge-ei is saját kulccsal
// szerepelnek, lib/pcicChains.ts). Ezek A1-en maradnak; a többi A1 `sentence`
// és az ÖSSZES A2 `sentence` a "+1" virtuális szintre kerül.
const A1_CHAIN_SENTENCE_IDS = new Set(Object.keys(a1Build as Record<string, unknown>));

/** Igaz, ha ez a tétel a "+1" virtuális szintre tartozik (nem a valódi A1/A2
 *  pakliba), tehát csak az "A1+"/"A2+" nézetben jelenik meg. */
export function isPlusSentence(id: string): boolean {
  const item = ITEM_BY_ID.get(id);
  if (!item || item.kind !== 'sentence') return false;
  const level = LEVEL_BY_ID.get(id);
  if (level === 'A1') return !A1_CHAIN_SENTENCE_IDS.has(id);
  if (level === 'A2') return true;
  return false;
}

/** A "+1" nézet mögötti valódi szint (a fájl, amiben a tétel ténylegesen
 *  él); a 4 valódi szintre önmagát adja vissza. */
export function realLevelOfView(view: PcicViewLevel): PcicLevel {
  if (view === 'A1+') return 'A1';
  if (view === 'A2+') return 'A2';
  return view;
}

/** Mint `pcicItemsForLevel`, de a "+1" virtuális szinteket is érti: a valódi
 *  szint nézetéből kimaradnak a "+1"-be tartozó mondatok, az "A1+"/"A2+"
 *  nézet pedig KIZÁRÓLAG azokat adja. */
export function pcicItemsForViewLevel(view: PcicViewLevel): PcicItem[] {
  const level = realLevelOfView(view);
  const wantPlus = view === 'A1+' || view === 'A2+';
  return ITEMS_BY_LEVEL[level].filter((it) => isPlusSentence(it.id) === wantPlus);
}
