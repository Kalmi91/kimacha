// PLAN-play 13. lépés (s6, Kálmán 2026-09-23, jóváhagyó lap
// https://claude.ai/artifact/HsKKPddM4KKt7wBQZmLVNo): "the words in the
// lesson's tables should be repeatable, same UI as the PCIC card, one pass
// through every word, then it resets; a wrong answer comes back a minute
// later like Anki". This module is the pure logic: which table cells count
// (conjugation tables only, decision (a): the reference GridTables are NOT
// included), the Anki-style scheduling (once right -> done, once wrong ->
// due again in 60s, "learn ahead" shows the soonest wrong cell if nothing
// else is due), and the reset once every cell has been answered right once.
//
// The UI (app/grammar/deck/[topic].tsx) owns rendering and persistence; this
// file only computes state, given an explicit `now`, so it is testable
// without timers.

import type { GrammarGapItem, GrammarItem, GrammarMarkItem, GrammarTopicData } from '../games/content';
import { isLessonV2, isMatchItem, isWhyItem } from '../games/content';
import { isConjugationTable, isMeaningTable, isPersonTable } from './tableShape';
import { DEFAULT_AGAIN_DELAY_SEC } from '../pcicSession';
import type { ExamplePair, LessonV2 } from './lessonTypes';
import { PCIC_LEVELS, pcicItemsForLevel, type PcicLevel } from '@/data/pcic';
import { normalizeWordToken, type Level } from '@/data/words';
import { hashString, shuffleArray } from '../shuffle';
import enA0 from '@/data/words/en/a0.json';
import enA1 from '@/data/words/en/a1.json';
import enA2 from '@/data/words/en/a2.json';
import enB1 from '@/data/words/en/b1.json';

export interface DeckCell {
  /** Stable within a lesson: `${tableId}::${person}::${verb}` (all lowercased). */
  id: string;
  /** The row's own label, e.g. "tú", "él/ella/usted". */
  person: string;
  /** The column header's infinitive, e.g. "ser". */
  verb: string;
  /** The table cell's raw text, e.g. "eres". strictAnswerMatch handles any
   *  "a / b" alternatives or parenthetical glosses on its own; this module
   *  does not need to split them out. */
  answer: string;
  /** FB378: the cell's English prompt ("she spoke"), if the table has one;
   *  the deck screen shows it instead of the bare person·verb prompt. */
  enPrompt?: string;
}

export interface DeckCellState {
  id: string;
  /** True once answered correctly; a done cell never comes back (until reset). */
  done: boolean;
  /** ms epoch it becomes due again after a wrong/empty answer; null = due now
   *  (never attempted yet, or freshly reset). */
  dueAt: number | null;
}

export interface DeckState {
  cells: DeckCellState[];
  /** FB377/FB389: bumped by resetDeckShuffled, part of the reshuffle seed so
   *  each shuffled pass through the deck gets a new (but still
   *  deterministic) order. Meaningless while `shuffled` is false. */
  resetCount: number;
  /** FB389: false = the deck's own order (the table read top to bottom, or
   *  the word-deck's own order); true = the seeded shuffle keyed on
   *  `resetCount`. A fresh deck (no persisted state) starts false; an old
   *  persisted deck saved before this field existed defaults to true, so a
   *  mid-pass reload does not silently reorder what the learner was seeing
   *  (mergeDeckState below). */
  shuffled: boolean;
}

// FELTEVÉS (Kálmán vétózhatja, PLAN-fb0923 5. lépés/D2): a táblázat-pakli
// "wrong answer comes back later" cooldownja UGYANABBÓL a beállításból
// olvas, mint a PCIC "rontott szó" időzítője (lib/pcicSession.ts
// again_delay_sec) - egy beállítás, két hely. A hívó (app/grammar/deck/
// [topic].tsx) adja át `answerCell`-nek; ha nincs átadva, ez a régi 60s marad.
const COOLDOWN_MS = DEFAULT_AGAIN_DELAY_SEC * 1000;

function normalizePerson(label: string): string {
  return label.trim().toLowerCase();
}

// FB357 convention (lib/grammar/vosotros.ts): vosotros stays in the lesson's
// reference tables, but never in something the learner has to produce. A
// table's row label is an exact, reliable signal here (unlike a drill item's
// free-text answer), so a plain set beats guessing from the conjugated form.
const VOSOTROS_PERSONS = new Set(['vosotros', 'vosotros/vosotras']);

/**
 * Every cell of every CONJUGATION table in a lesson (decision (a): reference
 * GridTables, e.g. hay-estar's article table, are excluded), vosotros rows
 * dropped, and the same person+verb pair counted once even if it somehow
 * repeats across two tables in the same lesson. FB390: a MEANING table
 * (isMeaningTable, e.g. interrogativos' "what -> qué" overview) is quizzed
 * the same way - prompt = the English meaning (row[0], shown via enPrompt),
 * answer = the Spanish term (row[1]) - instead of falling back to the
 * word-deck, where the target terms are often closed-class words
 * (qué/quién/dónde...) filtered out by FUNCTION_WORDS_ES below.
 */
export function tableCellsForLesson(lesson: GrammarTopicData | null | undefined): DeckCell[] {
  if (!lesson || !isLessonV2(lesson)) return [];
  const cells: DeckCell[] = [];
  const seen = new Set<string>();
  for (const block of lesson.body) {
    if (block.kind !== 'table') continue;
    // PLAN-fb1001 11. lépés: a személy-tábla (Persona -> ir a + infinitivo, Sujeto -> névmás)
    // ugyanúgy cella-kártyákat ad, mint a ragozási; a "verb" itt az oszlop-fejléc.
    if (isConjugationTable(block.header, block.rows) || isPersonTable(block.header, block.rows)) {
      const verbHeaders = block.header.slice(1);
      block.rows.forEach((row, ri) => {
        const person = row[0];
        if (VOSOTROS_PERSONS.has(normalizePerson(person))) return;
        for (let ci = 0; ci < verbHeaders.length; ci++) {
          const verb = verbHeaders[ci].es;
          const answer = row[ci + 1];
          if (!answer) continue;
          const key = `${normalizePerson(person)}::${verb.toLowerCase()}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const enPrompt = block.enPrompt?.[ri]?.[ci];
          cells.push({ id: `${block.id}::${key}`, person, verb, answer, ...(enPrompt ? { enPrompt } : {}) });
        }
      });
    } else if (isMeaningTable(block.header, block.rows)) {
      block.rows.forEach((row) => {
        const meaning = row[0];
        const answer = row[1];
        if (!meaning || !answer) return;
        const key = normalizePerson(meaning);
        if (seen.has(key)) return;
        seen.add(key);
        cells.push({ id: `${block.id}::${key}`, person: meaning, verb: '', answer, enPrompt: meaning });
      });
    }
  }
  return cells;
}

// FB375 (PLAN-fb0923 6. lépés): a scheduler csak `id`-t néz, sose a kártya
// tartalmát, ezért ugyanez a motor szolgálja ki a szó-paklit is
// (wordCellsForLesson lent) a tábla-pakli mellett, forrás-tömb-tipizálás
// nélkül duplikálva.
// FB377 (felülírva FB389-cel, lásd lent): a tábla-pakli sorrendje eleinte a
// tábla saját sor/oszlop-sorrendje volt (mindenki "yo · ser"-t látta
// elsőnek), amitől a válasz a POZÍCIÓBÓL, nem a jelentésből tanulható meg.
// FB389 (Kálmán 2026-09-08, felülírja a fenti döntést): az 1. kör megint a
// tábla sorrendjében jön (ahogy a tábla olvasható), a kevert sorrend egy
// KÜLÖN, választható "Nehezebb: keverve" kör lett (resetDeckShuffled), nem
// az alapértelmezett. A shuffle maga (a seed-elt permutáció) változatlan.
// Sorted first, so the result depends only on the SET of ids, never on
// whatever order they happened to arrive in, the order is a pure function
// of (ids, lessonId, resetCount).
function shuffledIds(cellIds: string[], lessonId: string, resetCount: number): string[] {
  return shuffleArray(cellIds.slice().sort(), hashString(`${lessonId}:${resetCount}`));
}

/** FB389: a fresh deck, in the SOURCE order (the table read top to bottom,
 *  or the word-deck's own order) - no shuffle. */
export function initDeckState(cells: { id: string }[]): DeckState {
  return { cells: cells.map((c) => ({ id: c.id, done: false, dueAt: null })), resetCount: 0, shuffled: false };
}

/**
 * Reconciles freshly-derived cells (from the lesson data) with a persisted
 * state (from game_progress). A cell the lesson no longer has is dropped; a
 * new cell the persisted state has never seen starts fresh. FB389: the order
 * follows the persisted `shuffled` flag - the SOURCE order (`cells`, as given)
 * when false, or the seeded shuffle (`lessonId` + the persisted reset count)
 * when true - never read off the persisted cell array itself, so a corpus
 * change (a cell added/removed) does not leave the new cell stuck at the end.
 * No persisted state at all (a lesson never opened before) defaults to the
 * SOURCE order (the new FB389 default); a persisted state saved before this
 * field existed has no `shuffled` key and defaults to true instead, so an
 * in-progress shuffled pass does not silently reorder on the next reload.
 */
export function mergeDeckState(cells: { id: string }[], lessonId: string, persisted: DeckState | undefined): DeckState {
  const resetCount = persisted?.resetCount ?? 0;
  const shuffled = persisted ? (persisted.shuffled ?? true) : false;
  const byId = new Map((persisted?.cells ?? []).map((c) => [c.id, c]));
  const ids = cells.map((c) => c.id);
  const order = shuffled ? shuffledIds(ids, lessonId, resetCount) : ids;
  return { cells: order.map((id) => byId.get(id) ?? { id, done: false, dueAt: null }), resetCount, shuffled };
}

export function doneCount(state: DeckState): number {
  return state.cells.filter((c) => c.done).length;
}

export function isDeckComplete(state: DeckState): boolean {
  return state.cells.length > 0 && state.cells.every((c) => c.done);
}

/**
 * The id of the cell to show next, or null if the deck is complete (or
 * empty). Preference: the first not-done cell that is due now (never
 * attempted, or its cooldown has passed), in the deck's own order. If
 * nothing is due yet, "learn ahead" like Anki: the not-done cell closest to
 * becoming due, so the learner is never stuck looking at a blank screen.
 */
export function nextCellId(state: DeckState, now: number): string | null {
  const pending = state.cells.filter((c) => !c.done);
  if (pending.length === 0) return null;
  const due = pending.find((c) => c.dueAt === null || c.dueAt <= now);
  if (due) return due.id;
  return pending.reduce((earliest, c) => (c.dueAt! < earliest.dueAt! ? c : earliest)).id;
}

/** Correct -> done, cleared cooldown. Wrong/empty -> due again after cooldownMs
 *  (default: the same again_delay_sec setting as the PCIC tab, see above). */
export function answerCell(
  state: DeckState,
  id: string,
  correct: boolean,
  now: number,
  cooldownMs: number = COOLDOWN_MS
): DeckState {
  return {
    ...state,
    cells: state.cells.map((c) =>
      c.id === id ? { ...c, done: correct, dueAt: correct ? null : now + cooldownMs } : c
    ),
  };
}

/** FB389: "Start again" - every cell answered right once (or the learner
 *  just wants a fresh pass) -> start over in the deck's own SOURCE order
 *  (the table read top to bottom / the word-deck's own order), same as a
 *  brand-new deck. Takes the canonical `cells` (not `state.cells`), because
 *  a prior "Harder: shuffled" pass may have left the state's own cell order
 *  shuffled - "Start again" always returns to the source order regardless. */
export function resetDeckInOrder(cells: { id: string }[]): DeckState {
  return initDeckState(cells);
}

/** FB389: "Harder: shuffled" - every cell, again, in a fresh (still
 *  deterministic) shuffle, so a repeated shuffled pass is not the same
 *  order as the last one. `resetCount` is the PREVIOUS state's count
 *  (bumped here), so consecutive shuffles keep advancing the seed. */
export function resetDeckShuffled(cells: { id: string }[], lessonId: string, resetCount: number): DeckState {
  const nextResetCount = resetCount + 1;
  const order = shuffledIds(cells.map((c) => c.id), lessonId, nextResetCount);
  return { cells: order.map((id) => ({ id, done: false, dueAt: null })), resetCount: nextResetCount, shuffled: true };
}

// ---------------------------------------------------------------------------
// FB375 (PLAN-fb0923 6. lépés, D5/a): "itt is legyen egy nyelvtanulós kártya
// csomag a szavakból" - a lecke SAJÁT szavaiból egy pakli azoknak a
// leckéknek, amiknek nincs ragozási táblájuk (tableCellsForLesson fent 0
// cellát ad rájuk). A scheduler fent content-agnosztikus, ez a rész csak a
// kártya-forrást adja: a lecke glosszáriuma ÉS a példamondatai (body+items),
// PCIC angol jelentéssel, funkciószó nélkül.
// ---------------------------------------------------------------------------

/** FB375 (PLAN-fb0923 6. lépés/D5, step 3): the word-deck button only shows
 *  at this many cards or more; below it, a table-less lesson stays
 *  buttonless rather than offering a near-empty deck. */
export const WORD_DECK_MIN_CARDS = 8;

export interface WordDeckCard {
  id: string;
  /** English side. en→es direction: the prompt (the word's meaning); es→en direction: the answer to type. */
  en: string;
  /** Spanish side. en→es direction: the answer to type; es→en direction: the prompt. */
  es: string;
}

// Zárt osztályú szófajok (véges alak-lista): névelő, elöljáró, névmás,
// kötőszó, plusz a "haber" segédige csupasz infinitivusa. Nyílt osztályú
// szófajra (főnév/ige/melléknév/határozó/szám) nincs teljes lista, azt a
// PCIC-egyezés dönti el; egy ragozott segédige-alak (es, ha, está...) amúgy
// sem egyezik semmilyen PCIC infinitivussal, tehát magától kimarad.
const FUNCTION_WORDS_ES = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'al', 'del',
  'a', 'ante', 'bajo', 'cabe', 'con', 'contra', 'de', 'desde', 'durante', 'en',
  'entre', 'hacia', 'hasta', 'mediante', 'para', 'por', 'según', 'sin', 'so', 'sobre', 'tras',
  'y', 'e', 'o', 'u', 'ni', 'pero', 'sino', 'aunque', 'porque', 'que', 'si', 'como', 'cuando', 'mientras', 'pues',
  'yo', 'tú', 'tu', 'vos', 'él', 'ella', 'usted', 'nosotros', 'nosotras', 'vosotros', 'vosotras', 'ellos', 'ellas', 'ustedes',
  'me', 'te', 'se', 'le', 'les', 'lo', 'nos', 'os',
  'mi', 'mí', 'su', 'sus', 'nuestro', 'nuestra', 'nuestros', 'nuestras', 'vuestro', 'vuestra', 'vuestros', 'vuestras',
  'este', 'esta', 'estos', 'estas', 'esto', 'ese', 'esa', 'esos', 'esas', 'eso', 'aquel', 'aquella', 'aquellos', 'aquellas', 'aquello',
  'quien', 'quienes', 'cual', 'cuales', 'cuyo', 'cuya', 'cuyos', 'cuyas',
  'qué', 'quién', 'quiénes', 'cuál', 'cuáles', 'cuánto', 'cuánta', 'cuántos', 'cuántas', 'cómo', 'cuándo', 'dónde',
  'haber',
]);

// A lecke szintje-vagy-alatta (D5/a): a PCIC csak A1..B2-t fed, A0 az A1-re
// esik, C1/C2 a B2-re (nincs feljebb PCIC-adat).
const PCIC_LEVEL_CEILING: Record<Level, PcicLevel> = {
  A0: 'A1', A1: 'A1', A2: 'A2', B1: 'B1', B2: 'B2', C1: 'B2', C2: 'B2',
};

const pcicIndexCache = new Map<Level, Map<string, { es: string; en: string }>>();

// Egyetlen szótári alakra kulcsolt (id, es, en) index, A1-től a lecke
// szintjéig kumulatívan, csak egy-tokenes (szóköz nélküli) tételekkel: egy
// mondatból szedett szó csak egy másik egy szavas PCIC-alakkal egyezhet
// pontosan, a PCIC 'sentence' tételei és a többszavas kifejezések itt nem
// forrás (azokat a szerző a glosszáriumba teheti, ha kellenek).
function pcicWordIndex(level: Level): Map<string, { es: string; en: string }> {
  const cached = pcicIndexCache.get(level);
  if (cached) return cached;
  const ceiling = PCIC_LEVELS.indexOf(PCIC_LEVEL_CEILING[level]);
  const index = new Map<string, { es: string; en: string }>();
  for (let i = 0; i <= ceiling; i++) {
    for (const item of pcicItemsForLevel(PCIC_LEVELS[i])) {
      if (item.kind === 'sentence') continue;
      const main = item.es.split(' / ')[0]; // perjeles válasznál (S1) a fő alak a szótári szó
      if (main.includes(' ')) continue;
      const key = normalizeWordToken(main);
      if (!key || index.has(key)) continue;
      index.set(key, { es: main, en: item.en });
    }
  }
  pcicIndexCache.set(level, index);
  return index;
}

// PLAN-fb1001 16. lépés (FB437/FB438, Kálmán "b" döntése 2026-10-01): a szó-pakli csak a
// lecke TÁBLÁZATAINAK szavaiból épül (minden `table` blokk minden cellájának tokenjei, az
// első előfordulás sorrendjében), nem a szószedetből és a példamondatok szavaiból.
// A szeparátorok (szóköz, "/", "+", zárójel) tokenekre vágnak ("él/ella/usted", "ir a + inf.").
function tableWordKeys(lesson: LessonV2): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const block of lesson.body) {
    if (block.kind !== 'table') continue;
    for (const row of block.rows) {
      for (const cell of row) {
        for (const token of cell.split(/[\s/+()]+/)) {
          const key = normalizeWordToken(token);
          if (!key || seen.has(key)) continue;
          seen.add(key);
          keys.push(key);
        }
      }
    }
  }
  return keys;
}

// A szószedet-bejegyzés glosszája, ha nem létező alakot jelöl (a rossz válasz-opciókhoz kell).
const NON_WORD_GLOSS = /^(not a real form|non-existent form)/i;

/**
 * A word-deck source for a lesson. PLAN-fb1001 16. lépés (Kálmán "b" döntése): ONLY the words
 * of the lesson's tables (tableWordKeys), never the glossary-only or example-sentence words
 * ("itt miért vannak ilyen szavak? felesleges"). A table word that the glossary glosses
 * (the author's own choice, so it skips the function-word filter - e.g. clases-de-palabras
 * glosses "mía"/"mío" on purpose) uses the glossary entry; any other table word counts if it
 * (a) is not a closed-class function word and (b) has an English meaning in the PCIC (at the
 * lesson's level or below). Order: glossary entries first, then first occurrence in the
 * tables; each word once (mergeDeckState/answerCell key on `id`, a repeat would silently
 * collide). A lesson without tables, or whose tables hold no such word, gives 0 cards, so
 * the caller (app/grammar/[topic].tsx) shows no deck entry.
 */
export function wordCellsForLesson(
  lesson: GrammarTopicData | null | undefined,
  learnedLang: string = 'es'
): WordDeckCard[] {
  if (!lesson || !isLessonV2(lesson)) return [];
  // FB471: a lecke maga kéri, hogy ne legyen szó-pakli (lecke-szintű kikapcsolás).
  if (lesson.noWordDeck) return [];
  // PLAN-fb0929 10. lépés (Kálmán 2026-09-30): es→en irányban a pakli az angol szókészletből épül.
  if (learnedLang === 'en') return wordCellsForEnglishLesson(lesson);
  const cards: WordDeckCard[] = [];
  const seen = new Set<string>();
  const tableKeys = tableWordKeys(lesson);
  const inTable = new Set(tableKeys);

  for (const g of lesson.glossary ?? []) {
    const key = normalizeWordToken(g.word);
    if (!key || seen.has(key) || !inTable.has(key)) continue;
    // FB419/FB418 (PLAN-fb0929 5. lépés): a rossz opciók nem létező alakjai ("lápizes", "vezes")
    // csak a hangolás miatt vannak a szószedetben (audit-games), nem szó-kártyának valók.
    if (NON_WORD_GLOSS.test(g.gloss.en)) continue;
    seen.add(key);
    cards.push({ id: `glossary::${key}`, es: g.word, en: g.gloss.en });
  }

  const pcic = pcicWordIndex(lesson.level);
  for (const key of tableKeys) {
    if (seen.has(key) || FUNCTION_WORDS_ES.has(key)) continue;
    const hit = pcic.get(key);
    if (!hit) continue;
    seen.add(key);
    cards.push({ id: `word::${key}`, es: hit.es, en: hit.en });
  }

  return cards;
}

// ---------------------------------------------------------------------------
// PLAN-fb0929 10. lépés (Kálmán 2026-09-30: "mehet a javítás"): az es→en irány
// szavak-gyakorlása. Eddig a pakli a spanyol PCIC-ből épült, ezért angol kérdést
// adott és spanyol választ várt. Most a kérdés a spanyol szó, a válasz a begépelt
// angol szó, a szavak az angol szókészletből (data/words/en/<szint>.json) jönnek,
// a lecke szintjén belül és a leckéhez kötve, három forrásból (ebben a sorrendben):
//   1. a lecke szószedete (glossary): a szerző saját választása, `word` az angol szó;
//   2. a lecke témájához kötött szavak (a szólista `topic` mezője = a lecke `topic`-ja,
//      vagy a `focusTopic`), a lecke saját szókincse, többszavas minta is lehet ("I am");
//   3. a lecke angol példamondataiból az a tartalmas szó, amelyik egyszavas angol
//      szólista-tétel (zárt osztályú szó nélkül).
// Ha nincs elég szó (WORD_DECK_MIN_CARDS alatt), a hívó nem mutat paklit.
// A spanyol irány (en→es, hu→es) ettől bájtra változatlan.
// ---------------------------------------------------------------------------

interface EnWordEntry {
  id: number;
  es: string;
  en: string;
  topic?: string;
  topicOrder?: number;
}

const EN_WORDS_BY_FILE: EnWordEntry[][] = [enA0, enA1, enA2, enB1] as unknown as EnWordEntry[][];

// A lecke szintje-vagy-alatta: A0/A1 -> a0+a1, A2 -> +a2, B1 és fölötte -> +b1 (B2/C nincs angol lista).
const EN_FILE_COUNT: Record<Level, number> = { A0: 2, A1: 2, A2: 3, B1: 4, B2: 4, C1: 4, C2: 4 };

const enWordsCache = new Map<Level, EnWordEntry[]>();

function enWordsUpTo(level: Level): EnWordEntry[] {
  const cached = enWordsCache.get(level);
  if (cached) return cached;
  const words = EN_WORDS_BY_FILE.slice(0, EN_FILE_COUNT[level] ?? 2).flat();
  enWordsCache.set(level, words);
  return words;
}

const enIndexCache = new Map<Level, Map<string, EnWordEntry>>();

// Egyszavas angol tételek kulcsa a kisbetűs angol szó, az első (alacsonyabb szintű) előfordulás marad.
function enWordIndex(level: Level): Map<string, EnWordEntry> {
  const cached = enIndexCache.get(level);
  if (cached) return cached;
  const index = new Map<string, EnWordEntry>();
  for (const w of enWordsUpTo(level)) {
    const key = w.en.split(' / ')[0].trim().toLowerCase(); // perjeles válasznál (S1) a fő alak a szótári szó
    if (!key || /\s/.test(key) || index.has(key)) continue;
    index.set(key, w);
  }
  enIndexCache.set(level, index);
  return index;
}

// Zárt osztályú angol szavak (névelő, névmás, elöljáró, kötőszó, segédige, kérdőszó): ezek nem szó-kártyák.
const FUNCTION_WORDS_EN = new Set([
  'a', 'an', 'the',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
  'my', 'your', 'his', 'its', 'our', 'their', 'mine', 'yours', 'hers', 'ours', 'theirs',
  'this', 'that', 'these', 'those', 'there',
  'and', 'or', 'but', 'so', 'if', 'because', 'when', 'while', 'than', 'as', 'then',
  'of', 'in', 'on', 'at', 'to', 'for', 'from', 'with', 'by', 'about', 'into', 'over', 'under', 'up', 'down', 'out', 'off', 'after', 'before', 'between', 'near', 'behind',
  'not', 'no', 'do', 'does', 'did', 'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'will', 'would', 'can', 'could', 'shall', 'should', 'may', 'might', 'must',
  'what', 'who', 'whom', 'whose', 'which', 'where', 'why', 'how',
]);

/** Egy angol szó-token kisbetűsen, a szélén lévő írásjel nélkül; '' ha nem egyszerű szó (szám, per-jel, ___ stb.). */
function enToken(raw: string): string {
  const t = raw.toLowerCase().replace(/[’‘]/g, "'").replace(/^[^a-z]+|[^a-z]+$/g, '');
  return /^[a-z][a-z']*$/.test(t) ? t : '';
}

function pushEnExamples(out: string[], examples: ExamplePair[] | undefined): void {
  // Az angol lecke konvenciója: az ExamplePair.es a TANULT (angol) mondat.
  for (const ex of examples ?? []) out.push(ex.es);
}

// A lecke angol (tanult nyelvű) mondatai és szavai. A Lang4 magyarázó szövegek a felület nyelvén
// vannak (spanyolul), azok nem forrás; a táblák celláit itt is felvesszük (angolra nincs tábla-pakli).
function lessonSentencesEn(lesson: LessonV2): string[] {
  const out: string[] = [];
  for (const block of lesson.body) {
    switch (block.kind) {
      case 'list':
        for (const item of block.items) pushEnExamples(out, item.examples);
        break;
      case 'usage':
        for (const point of block.points) pushEnExamples(out, point.examples);
        break;
      case 'examples':
        pushEnExamples(out, block.examples);
        break;
      case 'contrast':
        for (const pair of block.pairs) {
          out.push(pair.a, pair.b);
          pushEnExamples(out, pair.examples);
        }
        break;
      case 'table':
        for (const row of block.rows) out.push(...row);
        break;
      case 'text':
      case 'tip':
        break;
    }
  }
  for (const item of lesson.items as GrammarItem[]) {
    if (item.kind === undefined || item.kind === 'gap') {
      const gap = item as GrammarGapItem;
      out.push(gap.sentence, ...(gap.examples ?? []));
    } else if (item.kind === 'mark') {
      const mark = item as GrammarMarkItem;
      out.push(mark.sentence, ...(mark.examples ?? []));
    } else if (isMatchItem(item)) {
      for (const pair of item.pairs) out.push(pair.en);
    } else if (isWhyItem(item)) {
      out.push(item.es);
    } else if (item.kind === 'form') {
      out.push(item.answer);
    }
  }
  return out;
}

function wordCellsForEnglishLesson(lesson: LessonV2): WordDeckCard[] {
  const cards: WordDeckCard[] = [];
  const seen = new Set<string>(); // kisbetűs angol válasz: egy szó egyszer (mergeDeckState/answerCell id-re kulcsol)
  const push = (id: string, es: string, enRaw: string) => {
    const en = enRaw.split(' / ')[0]; // perjeles válasznál (S1) a kártya a fő alakot kéri
    const key = en.trim().toLowerCase();
    if (!key || !es.trim() || seen.has(key)) return;
    seen.add(key);
    cards.push({ id, es, en });
  };

  // 1) a szerző szószedete: `word` az angol szó, a gloss.es a spanyol kérdés
  for (const g of lesson.glossary ?? []) {
    if (NON_WORD_GLOSS.test(g.gloss.en)) continue;
    const key = enToken(g.word);
    if (key) push(`glossary::${key}`, g.gloss.es, g.word);
  }

  // 2) a lecke témájához kötött szavak, a szintjén belül (a szólista topic mezője)
  const topics = new Set([lesson.topic, lesson.focusTopic].filter((t): t is string => !!t));
  if (topics.size > 0) {
    const linked = enWordsUpTo(lesson.level).filter((w) => w.topic && topics.has(w.topic));
    linked.sort((a, b) => (a.topicOrder ?? 0) - (b.topicOrder ?? 0));
    for (const w of linked) push(`topic::${w.id}`, w.es, w.en);
  }

  // 3) a példamondatok tartalmas szavai, ha egyszavas angol szólista-tételek
  const index = enWordIndex(lesson.level);
  for (const sentence of lessonSentencesEn(lesson)) {
    for (const raw of sentence.split(/\s+/)) {
      const key = enToken(raw);
      if (!key || FUNCTION_WORDS_EN.has(key)) continue;
      const hit = index.get(key);
      if (hit) push(`word::${key}`, hit.es, hit.en);
    }
  }

  return cards;
}
