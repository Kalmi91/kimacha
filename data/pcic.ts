// PLAN-pcic 5. lépés: adat-betöltő a PCIC fülhöz. Csak import + típus +
// helper, az adat maga a data/pcic/*.json fájlokban él (K1 konvenció).
// PLAN-play 10. lépés: négy szint (A1/A2/B1/B2), a korábbi B1-only betöltés
// helyett. Az item id-k szint-előtaggal jönnek ("a1-...", "b1-...", ...), ez
// a haladás szintenkénti elkülönülésének is az alapja (lib/pcicLevels.ts).

import a1Raw from './pcic/a1-all.json';
import a1En from './pcic/a1-en.json';
import a1Sentences from './pcic/a1-sentences.json';
import a2Raw from './pcic/a2-all.json';
import a2En from './pcic/a2-en.json';
import a2Sentences from './pcic/a2-sentences.json';
import b1Raw from './pcic/b1-all.json';
import b1En from './pcic/b1-en.json';
import b1Sentences from './pcic/b1-sentences.json';
import b2Raw from './pcic/b2-all.json';
import b2En from './pcic/b2-en.json';
import b2Sentences from './pcic/b2-sentences.json';
import type { WordPos } from './words';

export type PcicKind = 'word' | 'phrase' | 'sentence' | 'pattern';
export type PcicLevel = 'A1' | 'A2' | 'B1' | 'B2';

export const PCIC_LEVELS: PcicLevel[] = ['A1', 'A2', 'B1', 'B2'];

// s1 (anki-ui-terv.html): a négy szint felirata a szint-választó lapon.
export const LEVEL_LABELS: Record<PcicLevel, string> = {
  A1: 'Beginner',
  A2: 'Elementary',
  B1: 'Intermediate',
  B2: 'Upper intermediate',
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
  // ahol a lib/pcicPos.ts korpusz-egyezés/szabály nem ad találatot.
  pos?: WordPos;
}

export interface PcicItem {
  id: string;
  es: string;
  en: string;
  kind: PcicKind;
  section: string;
  order: number;
  pos?: WordPos;
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
for (const level of PCIC_LEVELS) {
  for (const item of ITEMS_BY_LEVEL[level]) ITEM_BY_ID.set(item.id, item);
}

export function pcicItemsForLevel(level: PcicLevel): PcicItem[] {
  return ITEMS_BY_LEVEL[level];
}

export function findPcicItem(id: string): PcicItem | undefined {
  return ITEM_BY_ID.get(id);
}
