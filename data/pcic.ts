// Az Anki-fül paklijai: en→es irányban a data/words-open (o<order> id-tér), es→en
// irányban a data/words/en (e<id> id-tér). PLAN-regi-szavak-ki 6. lépés: a PCIC-korpusz
// és a régi spanyol szólista (w<id>) kikerült, a modul neve és API-ja a fogyasztók
// (lib/pcicLevels.ts, lib/pcicSession.ts, lib/grammar/tableDeck.ts, app/(tabs)/index.tsx,
// app/onboarding.tsx, components/LevelPickerSheet.tsx, ...) miatt maradt.

import type { Pos } from '@/lib/pcicPos';
import type { WordEntry } from '@/data/words';
// PLAN-ketiranyu 5. lépés (D-A döntés, 2026-09-26: "a", a régi angol-célnyelvű
// ág kész, ellenőrzött kártyái, ~0 token). Csak ez a modul importálja, e<id>
// id-térrel (lásd itemsFromWords). PLAN-esen: A1 = a0 + a1, A2 = a2.
import enA0 from '@/data/words/en/a0.json';
import enA1 from '@/data/words/en/a1.json';
import enA2 from '@/data/words/en/a2.json';
import enB1 from '@/data/words/en/b1.json';
// PLAN-learn-words-open (2026-10-01): az en→es pakli forrása az új, 600
// kártyás data/words-open (o<order> id-tér, lásd itemsFromOpen).
import openA1 from '@/data/words-open/a1.json';
import openA2 from '@/data/words-open/a2.json';
import openB1 from '@/data/words-open/b1.json';
import openB2 from '@/data/words-open/b2.json';
// FB481/495/496/498 (PLAN-fb1005e): kézzel írt (i) magyarázat egyes kártyákra, `o<order>` kulccsal,
// angol szöveggel; a Learn-kártya kis (i) gombja nyitja (PcicItem.note).
import openNotes from '@/data/words-open/notes.json';
// FB498/500 (PLAN-fb1005i): kép egyes kártyákhoz (Wikimedia Commons), az (i) alatt a magyarázat mellett.
import { wordImageFor, type WordImage } from '@/data/wordImages';

export type PcicKind = 'word' | 'phrase' | 'sentence';
export type PcicLevel = 'A1' | 'A2' | 'B1' | 'B2';

export const PCIC_LEVELS: PcicLevel[] = ['A1', 'A2', 'B1', 'B2'];

// PLAN-learn-words-open 2. lépés: a B2 is választható (en→es 150 tétel); az
// es→en iránynál B2 üres, ott a szint-választók a "0 tétel = nem kínáljuk fel"
// szűrővel kihagyják.
export const PCIC_VIEW_LEVELS: PcicLevel[] = ['A1', 'A2', 'B1', 'B2'];

export interface PcicItem {
  id: string;
  es: string;
  en: string;
  kind: PcicKind;
  section: string;
  order: number;
  pos?: Pos;
  // PLAN-play 11. lépés: példamondat a korpuszból, csak ha van egyezés;
  // a Check utáni felfedésen jelenik meg.
  exampleEs?: string;
  exampleEn?: string;
  // PLAN-tobbjelentes 3. lépés (SZ8): kis mondat a kérdés-szó alatt, ha a kérdésnek
  // több jelentése van (words-open hint_en / angol track hint_es); a kérdezett szó
  // `*csillag*` között áll.
  hint?: string;
  // FB481/495/496/498: (i) magyarázat (angol, rövid), csak a kézzel jegyzetelt kártyákon van.
  note?: string;
  // FB498/500: a kártya képe (szerzővel és licenccel), csak a képpel ellátott kártyákon van.
  image?: WordImage;
}

const LEADING_ARTICLE_RE = /^(el|la|los|las|un|una)\s+/i;

// `kind`: 'phrase', ha a névelő levágása után is több szó marad, különben 'word'.
// PLAN-tobbjelentes 3. lépés (S1): perjeles " / " alaknál minden alternatívát külön
// nézünk ("el carro / el coche" egy szavas főnévként 'word', nem 'phrase').
export function kindOfEs(es: string): PcicKind {
  const isPhrase = es.split(' / ').some((alt) => {
    const stripped = alt.trim().replace(LEADING_ARTICLE_RE, '');
    return stripped.split(/\s+/).filter(Boolean).length > 1;
  });
  return isPhrase ? 'phrase' : 'word';
}

function noteField(word: WordEntry, key: 'hint_es'): string | undefined {
  const value = word[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

// FB357-jelzésű (vosotros: true) kártya kimarad, ahogy a nyelvtani leckéknél is.
// PLAN-ketiranyu 4. lépés: az 'e' előtag különbözteti meg a két irány id-terét
// a KÖZÖS pcic_cards táblában (nincs pár-oszlop): en→es 'o<order>' (itemsFromOpen), es→en 'e<id>'.
function itemsFromWords(entries: WordEntry[]): PcicItem[] {
  return entries
    .filter((w) => !w.vosotros)
    .map((w, index) => ({
      id: `e${w.id}`,
      es: w.es,
      en: w.en,
      kind: kindOfEs(w.es),
      section: '',
      order: index,
      pos: w.pos,
      exampleEs: w.sentence_es,
      exampleEn: w.sentence_en,
      hint: noteField(w, 'hint_es'),
    }));
}

// PLAN-learn-words-open: a data/words-open kártyáiból (a1/a2/b1/b2.json, A1 =
// csak a1.json, nincs külön A0). Id-tér: o<order> (a fájl `order` mezője,
// 1-600), hogy ne ütközzön a régi w<id> és az es→en e<id> id-kkel. A words-open
// pos-ából minden szófaj átmegy az app Pos-ába (FB482: a det és interj is chipet kap).
type OpenCard = { order: number; pos: string; es: string; en: string; sentence_es: string; sentence_en: string; hint_en?: string };

const OPEN_POS_TO_PCIC: Partial<Record<string, Pos>> = {
  noun: 'noun',
  verb: 'verb',
  adj: 'adj',
  adv: 'adv',
  pron: 'pron',
  prep: 'prep',
  num: 'num',
  conj: 'conj',
  det: 'det',
  interj: 'interj',
};

function itemsFromOpen(cards: OpenCard[]): PcicItem[] {
  return cards.map((c) => ({
    id: `o${c.order}`,
    es: c.es,
    en: c.en,
    kind: kindOfEs(c.es),
    section: '',
    order: c.order,
    pos: OPEN_POS_TO_PCIC[c.pos],
    exampleEs: c.sentence_es || undefined,
    exampleEn: c.sentence_en || undefined,
    hint: c.hint_en || undefined,
    note: (openNotes as Record<string, string>)[`o${c.order}`],
    image: wordImageFor(`o${c.order}`),
  }));
}

const ITEMS_BY_LEVEL_ES: Record<PcicLevel, PcicItem[]> = {
  A1: itemsFromOpen(openA1 as OpenCard[]),
  A2: itemsFromOpen(openA2 as OpenCard[]),
  B1: itemsFromOpen(openB1 as OpenCard[]),
  B2: itemsFromOpen(openB2 as OpenCard[]),
};

// PLAN-esen (2026-09-28): az es→en irány A1 paklija = data/words/en/a0.json +
// a1.json (külön A0 nincs), A2 = a2.json (e<id> id-tér, a régi első 50 id-je
// nem változik). Ugyanaz az angol szó csak egyszer, az első előfordulásánál
// (alacsonyabb szinten) marad. B1 = en/b1.json (PLAN-enb1, CEFR-J szólista,
// e10000-től); B2 üres (nincs rá tartalom), a szint-választók a "0 tétel =
// nem kínáljuk fel" szabállyal kihagyják.
function dedupeByEn(levels: WordEntry[][]): WordEntry[][] {
  const seen = new Set<string>();
  return levels.map((entries) =>
    entries.filter((w) => {
      const key = w.en.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  );
}

const [EN_A1_WORDS, EN_A2_WORDS, EN_B1_WORDS] = dedupeByEn([
  [...(enA0 as WordEntry[]), ...(enA1 as WordEntry[])],
  enA2 as WordEntry[],
  enB1 as WordEntry[],
]);

const ITEMS_BY_LEVEL_EN: Record<PcicLevel, PcicItem[]> = {
  A1: itemsFromWords(EN_A1_WORDS),
  A2: itemsFromWords(EN_A2_WORDS),
  B1: itemsFromWords(EN_B1_WORDS),
  B2: [],
};

// PLAN-ketiranyu 4. lépés: melyik irány paklija aktív (app/_layout.tsx az
// induláskor, app/onboarding.tsx a választáskor, a Settings irányváltó sora
// a váltáskor állítja, az onboarding.target kódjával: 'es' = en→es, 'en' =
// es→en). Modul-szintű állapot, mint a lib/database.ts activePair-je.
export type PcicTarget = 'es' | 'en';

let activeTarget: PcicTarget = 'es';

export function setPcicTarget(target: PcicTarget) {
  activeTarget = target;
}

export function getPcicTarget(): PcicTarget {
  return activeTarget;
}

function itemsByTarget(target: PcicTarget): Record<PcicLevel, PcicItem[]> {
  return target === 'en' ? ITEMS_BY_LEVEL_EN : ITEMS_BY_LEVEL_ES;
}

function buildIndexes(byLevel: Record<PcicLevel, PcicItem[]>) {
  const itemById = new Map<string, PcicItem>();
  const levelById = new Map<string, PcicLevel>();
  for (const level of PCIC_LEVELS) {
    for (const item of byLevel[level]) {
      itemById.set(item.id, item);
      levelById.set(item.id, level);
    }
  }
  return { itemById, levelById };
}

const INDEXES_ES = buildIndexes(ITEMS_BY_LEVEL_ES);
const INDEXES_EN = buildIndexes(ITEMS_BY_LEVEL_EN);

function indexesByTarget(target: PcicTarget) {
  return target === 'en' ? INDEXES_EN : INDEXES_ES;
}

export function pcicItemsForLevel(level: PcicLevel): PcicItem[] {
  return itemsByTarget(activeTarget)[level];
}

export function findPcicItem(id: string): PcicItem | undefined {
  return indexesByTarget(activeTarget).itemById.get(id);
}

/** A betöltött korpuszban élő item TÉNYLEGES szintje, vagy undefined, ha az
 *  id nincs a korpuszban (pl. a régi PCIC-korpusz árva SRS-sora). */
export function levelOfItem(id: string): PcicLevel | undefined {
  return indexesByTarget(activeTarget).levelById.get(id);
}
