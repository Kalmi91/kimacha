// PLAN-ketiranyu 2. lépés (2026-09-28): az Anki-fül mostantól a spanyol
// gyakorisági szókészletből (data/words/{a0,a1,a2,b1,b2}.json) épül, nem a
// PCIC-korpuszból. A régi tartalom VÁLTOZATLANUL a data/pcicCorpus.ts-be
// költözött (csak teszt/script importálhatja onnan, lib/__tests__/
// noPcicInBundle.test.ts az őr). Ez a modul ugyanazt az exportált API-t adja,
// hogy a fogyasztók (lib/pcicNotes.ts, lib/pcicLevels.ts, lib/pcicSession.ts,
// lib/grammar/tableDeck.ts, app/(tabs)/index.tsx, app/onboarding.tsx,
// app/spelling.tsx, components/LevelPickerSheet.tsx, ...) ne változzanak.

import type { Pos } from '@/lib/pcicPos';
import { getWordsForLevel, type WordEntry } from '@/data/words';
// PLAN-ketiranyu 5. lépés (D-A döntés, 2026-09-26: "a", a régi angol-célnyelvű
// ág kész, ellenőrzött kártyái, ~0 token). Csak ez a modul importálja, e<id>
// id-térrel (lásd itemsFromWords). PLAN-esen: A1 = a0 + a1, A2 = a2.
import enA0 from '@/data/words/en/a0.json';
import enA1 from '@/data/words/en/a1.json';
import enA2 from '@/data/words/en/a2.json';
import enB1 from '@/data/words/en/b1.json';

export type PcicKind = 'word' | 'phrase' | 'sentence' | 'pattern';
export type PcicLevel = 'A1' | 'A2' | 'B1' | 'B2';

export const PCIC_LEVELS: PcicLevel[] = ['A1', 'A2', 'B1', 'B2'];

// A gyakorisági korpusznak nincs `sentence` kind tétele (isPlusSentence
// mindig false lent), ezért az "A1+"/"A2+" virtuális szint kiesik a
// VÁLASZTHATÓ szintek közül. A `PcicViewLevel` típus marad A1+/A2+-szal
// (LEVEL_LABELS, realLevelOfView visszakompatibilitás), csak a
// PCIC_VIEW_LEVELS lista rövidült.
export type PcicViewLevel = PcicLevel | 'A1+' | 'A2+';
export const PCIC_VIEW_LEVELS: PcicViewLevel[] = ['A1', 'A2', 'B1'];

// s1 (anki-ui-terv.html): a négy szint felirata a szint-választó lapon.
export const LEVEL_LABELS: Record<PcicViewLevel, string> = {
  A1: 'Beginner',
  A2: 'Elementary',
  B1: 'Intermediate',
  B2: 'Upper intermediate',
  'A1+': '+1 · sentences',
  'A2+': '+1 · sentences',
};

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
  // PLAN-play 11. lépés: példamondat a korpuszból, csak ha van egyezés;
  // a Check utáni felfedésen jelenik meg.
  exampleEs?: string;
  exampleEn?: string;
  // PLAN-ketiranyu 2. lépés: a lib/cardNotes.ts hibrid ℹ️ jegyzet-mezője
  // (FB75), ha a szónak van kézzel írt note_en/note_hu-ja.
  noteEn?: string;
  noteHu?: string;
}

const LEADING_ARTICLE_RE = /^(el|la|los|las|un|una)\s+/i;

// `kind`: 'phrase', ha a névelő levágása után is több szó marad, különben 'word'.
function kindOfEs(es: string): PcicKind {
  const stripped = es.trim().replace(LEADING_ARTICLE_RE, '');
  const wordCount = stripped.split(/\s+/).filter(Boolean).length;
  return wordCount > 1 ? 'phrase' : 'word';
}

function noteField(word: WordEntry, key: 'note_en' | 'note_hu'): string | undefined {
  const value = word[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

// FB357-jelzésű (vosotros: true) kártya kimarad, ahogy a nyelvtani leckéknél is.
// PLAN-ketiranyu 4. lépés: `idPrefix` különbözteti meg a két irány id-terét
// a KÖZÖS pcic_cards táblában (nincs pár-oszlop): en→es 'w<id>', es→en 'e<id>'.
function itemsFromWords(entries: WordEntry[], idPrefix: 'w' | 'e' = 'w'): PcicItem[] {
  return entries
    .filter((w) => !w.vosotros)
    .map((w, index) => ({
      id: `${idPrefix}${w.id}`,
      es: w.es,
      en: w.en,
      kind: kindOfEs(w.es),
      section: '',
      order: index,
      pos: w.pos,
      exampleEs: w.sentence_es,
      exampleEn: w.sentence_en,
      noteEn: noteField(w, 'note_en'),
      noteHu: noteField(w, 'note_hu'),
    }));
}

// A1 nézet = a0 + a1 (a1 fájl önmagában túl kevés lenne); A2 = a2; B1 = b1;
// B2 az adatban marad (data/words/b2.json), csak a PCIC_VIEW_LEVELS nem
// kínálja fel a szint-választón.
const ITEMS_BY_LEVEL_ES: Record<PcicLevel, PcicItem[]> = {
  A1: itemsFromWords([...getWordsForLevel('A0'), ...getWordsForLevel('A1')], 'w'),
  A2: itemsFromWords(getWordsForLevel('A2'), 'w'),
  B1: itemsFromWords(getWordsForLevel('B1'), 'w'),
  B2: itemsFromWords(getWordsForLevel('B2'), 'w'),
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
  A1: itemsFromWords(EN_A1_WORDS, 'e'),
  A2: itemsFromWords(EN_A2_WORDS, 'e'),
  B1: itemsFromWords(EN_B1_WORDS, 'e'),
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

/** A gyakorisági korpusznak nincs `sentence` kind tétele, tehát a "+1"
 *  virtuális szint (a régi PCIC mondat-lánc funkciója) sose kap tartalmat. */
export function isPlusSentence(_id: string): boolean {
  return false;
}

/** A "+1" nézet mögötti valódi szint; a 4 valódi szintre önmagát adja vissza. */
export function realLevelOfView(view: PcicViewLevel): PcicLevel {
  if (view === 'A1+') return 'A1';
  if (view === 'A2+') return 'A2';
  return view;
}

/** Mint `pcicItemsForLevel`, de a "+1" virtuális szinteket is érti: mivel
 *  `isPlusSentence` mindig false, az "A1+"/"A2+" nézet mindig üres listát ad. */
export function pcicItemsForViewLevel(view: PcicViewLevel): PcicItem[] {
  const level = realLevelOfView(view);
  const wantPlus = view === 'A1+' || view === 'A2+';
  return itemsByTarget(activeTarget)[level].filter((it) => isPlusSentence(it.id) === wantPlus);
}
