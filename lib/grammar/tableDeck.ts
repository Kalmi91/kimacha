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
import { isLessonV2, isMatchItem, isTransformItem, isWhyItem } from '../games/content';
import { isConjugationTable, isMeaningTable } from './tableShape';
import { DEFAULT_AGAIN_DELAY_SEC } from '../pcicSession';
import type { ExamplePair, Lang4, LessonV2 } from './lessonTypes';
import { PCIC_LEVELS, pcicItemsForLevel, type PcicLevel } from '@/data/pcic';
import { normalizeWordToken, type Level } from '@/data/words';
import { hashString, shuffleArray } from '../shuffle';

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
  /** FB377: bumped by resetDeck, part of the reshuffle seed so each pass
   *  through the deck gets a new (but still deterministic) order. */
  resetCount: number;
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
    if (isConjugationTable(block.header, block.rows)) {
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
// FB377: the deck's cell order used to be the table's own row/column order
// (every learner saw "yo · ser" first, always), which makes the answers
// memorizable by position instead of by meaning. A seeded shuffle (lesson id
// + reset count) fixes the order for a given pass through the deck, so it is
// still deterministic and testable, but it is not the table's order, and a
// "Start again" reset gets a fresh shuffle.
// Sorted first, so the result depends only on the SET of ids, never on
// whatever order they happened to arrive in (table order from a fresh
// lesson load, or the previous pass's shuffled order on a reset), the
// order is a pure function of (ids, lessonId, resetCount).
function shuffledIds(cellIds: string[], lessonId: string, resetCount: number): string[] {
  return shuffleArray(cellIds.slice().sort(), hashString(`${lessonId}:${resetCount}`));
}

export function initDeckState(cells: { id: string }[], lessonId: string): DeckState {
  const order = shuffledIds(cells.map((c) => c.id), lessonId, 0);
  return { cells: order.map((id) => ({ id, done: false, dueAt: null })), resetCount: 0 };
}

/**
 * Reconciles freshly-derived cells (from the lesson data) with a persisted
 * state (from game_progress). A cell the lesson no longer has is dropped; a
 * new cell the persisted state has never seen starts fresh. The order is
 * reshuffled from `lessonId` + the persisted reset count, not read off the
 * persisted cell array, so a corpus change (a cell added/removed) does not
 * leave the new cell stuck at the end.
 */
export function mergeDeckState(cells: { id: string }[], lessonId: string, persisted: DeckState | undefined): DeckState {
  const resetCount = persisted?.resetCount ?? 0;
  const byId = new Map((persisted?.cells ?? []).map((c) => [c.id, c]));
  const order = shuffledIds(cells.map((c) => c.id), lessonId, resetCount);
  return { cells: order.map((id) => byId.get(id) ?? { id, done: false, dueAt: null }), resetCount };
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

/** Every cell answered right once -> start the pass over, with a fresh
 *  (still deterministic) shuffle, so the next pass isn't the same order. */
export function resetDeck(state: DeckState, lessonId: string): DeckState {
  const resetCount = state.resetCount + 1;
  const order = shuffledIds(state.cells.map((c) => c.id), lessonId, resetCount);
  return { cells: order.map((id) => ({ id, done: false, dueAt: null })), resetCount };
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
  /** The prompt: the word's English meaning. */
  en: string;
  /** The answer to type: the Spanish word. */
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
      if (item.kind === 'sentence' || item.es.includes(' ')) continue;
      const key = normalizeWordToken(item.es);
      if (!key || index.has(key)) continue;
      index.set(key, { es: item.es, en: item.en });
    }
  }
  pcicIndexCache.set(level, index);
  return index;
}

function pushLang4(out: string[], text: Lang4 | undefined): void {
  if (text?.es) out.push(text.es);
}

function pushExamples(out: string[], examples: ExamplePair[] | undefined): void {
  for (const ex of examples ?? []) out.push(ex.es);
}

// A lecke minden spanyol példamondata: body-blokkok (a táblák celláit
// tableCellsForLesson már lefedi, itt kimaradnak) + items (form-nak nincs
// önálló "es" mezője - verb/person/answer kategória-címke is lehet, pl.
// "Adverbio (-mente)" -, ezért az marad ki egyedüliként).
function lessonSentences(lesson: LessonV2): string[] {
  const out: string[] = [];
  for (const block of lesson.body) {
    switch (block.kind) {
      case 'text':
      case 'tip':
        pushLang4(out, block.text);
        break;
      case 'list':
        for (const item of block.items) {
          pushLang4(out, item.text);
          pushExamples(out, item.examples);
        }
        break;
      case 'usage':
        for (const point of block.points) {
          pushLang4(out, point.text);
          pushExamples(out, point.examples);
        }
        break;
      case 'examples':
        pushExamples(out, block.examples);
        break;
      case 'contrast':
        for (const pair of block.pairs) {
          out.push(pair.a, pair.b);
          pushLang4(out, pair.note);
          pushExamples(out, pair.examples);
        }
        break;
      case 'table':
        break;
    }
  }
  for (const item of lesson.items as GrammarItem[]) {
    if (item.kind === undefined || item.kind === 'gap') {
      const gap = item as GrammarGapItem;
      out.push(gap.sentence, ...gap.examples);
    } else if (item.kind === 'mark') {
      const mark = item as GrammarMarkItem;
      out.push(mark.sentence, ...mark.examples);
    } else if (isMatchItem(item)) {
      for (const pair of item.pairs) out.push(pair.es);
    } else if (isWhyItem(item)) {
      out.push(item.es);
    } else if (isTransformItem(item)) {
      out.push(item.answer);
    }
  }
  return out;
}

/**
 * A word-deck source for a lesson: its glossary entries (the author's own
 * choice, so these never go through the function-word filter below - e.g.
 * clases-de-palabras glosses "mía"/"mío" on purpose, as vocabulary), plus
 * every content word from its example sentences that both (a) is not a
 * closed-class function word and (b) has an English meaning in the PCIC
 * (at the lesson's level or below). Order: glossary first, then first
 * occurrence in the sentences; each word once (mergeDeckState/answerCell
 * key on `id`, a repeat would silently collide).
 */
export function wordCellsForLesson(lesson: GrammarTopicData | null | undefined): WordDeckCard[] {
  if (!lesson || !isLessonV2(lesson)) return [];
  const cards: WordDeckCard[] = [];
  const seen = new Set<string>();

  for (const g of lesson.glossary ?? []) {
    const key = normalizeWordToken(g.word);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    cards.push({ id: `glossary::${key}`, es: g.word, en: g.gloss.en });
  }

  const pcic = pcicWordIndex(lesson.level);
  for (const sentence of lessonSentences(lesson)) {
    for (const token of sentence.split(/\s+/)) {
      const key = normalizeWordToken(token);
      if (!key || seen.has(key) || FUNCTION_WORDS_ES.has(key)) continue;
      const hit = pcic.get(key);
      if (!hit) continue;
      seen.add(key);
      cards.push({ id: `word::${key}`, es: hit.es, en: hit.en });
    }
  }

  return cards;
}
