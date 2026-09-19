// PLAN-pcic 5. lépés: adat-betöltő a PCIC fülhöz. Csak import + típus +
// helper, az adat maga a data/pcic/*.json fájlokban él (K1 konvenció).

import rawItems from './pcic/b1-all.json';
import enById from './pcic/b1-en.json';

export type PcicKind = 'word' | 'phrase' | 'sentence' | 'pattern';

interface RawPcicItem {
  id: string;
  es: string;
  kind: PcicKind;
  source: string;
  section: string;
  headword?: string;
  order?: number;
}

export interface PcicItem {
  id: string;
  es: string;
  en: string;
  kind: PcicKind;
  section: string;
  order: number;
}

const items = rawItems as RawPcicItem[];
const enMap = enById as Record<string, string>;

// A `pattern` kind (nyelvtani minta, nem szókincs-tétel) kimarad, és csak
// azok a tételek maradnak, amikhez van angol fordítás.
export const PCIC_ITEMS: PcicItem[] = items
  .map((item, index) => ({
    id: item.id,
    es: item.es,
    en: enMap[item.id] ?? '',
    kind: item.kind,
    section: item.section,
    order: item.order ?? index,
  }))
  .filter((item) => item.kind !== 'pattern' && item.en.length > 0)
  .sort((a, b) => a.order - b.order);

export function findPcicItem(id: string): PcicItem | undefined {
  return PCIC_ITEMS.find((item) => item.id === id);
}
