// PLAN-play 13. lépés (s6): pure-logic tests for the table-deck (Anki-style
// practice built from a lesson's conjugation tables). Uses the real lesson
// data (ser-estar, presente-regular, hay-estar) so a corpus change that
// breaks the deck is caught here, not just in a hand-rolled fixture.

import { lessonFor } from '../syllabus';
import { isLessonV2 } from '../../games/content';
import type { LessonV2 } from '../lessonTypes';
import { hashString, shuffleArray } from '../../shuffle';
import {
  answerCell,
  doneCount,
  initDeckState,
  isDeckComplete,
  mergeDeckState,
  nextCellId,
  resetDeck,
  tableCellsForLesson,
  wordCellsForLesson,
  WORD_DECK_MIN_CARDS,
  type DeckCellState,
  type DeckState,
} from '../tableDeck';

describe('tableCellsForLesson', () => {
  it('ser-estar: 2 conjugation tables x 6 persons, vosotros dropped -> 10 cells', () => {
    const lesson = lessonFor('es', 'ser-estar')!;
    const cells = tableCellsForLesson(lesson);
    expect(cells).toHaveLength(10);
    expect(cells.some((c) => c.person.toLowerCase().includes('vosotros'))).toBe(false);
    const tu = cells.find((c) => c.person === 'tú' && c.verb === 'ser');
    expect(tu?.answer).toBe('eres');
  });

  it('a lesson with only reference (non-conjugation) tables has 0 cells (decision a)', () => {
    const lesson = lessonFor('es', 'hay-estar')!;
    expect(tableCellsForLesson(lesson)).toEqual([]);
  });

  it('a schema-1 (legacy) lesson has no body, so 0 cells', () => {
    const lesson = lessonFor('es', 'posesivos')!;
    expect(tableCellsForLesson(lesson)).toEqual([]);
  });

  it('null/undefined lesson -> 0 cells', () => {
    expect(tableCellsForLesson(undefined)).toEqual([]);
    expect(tableCellsForLesson(null)).toEqual([]);
  });

  it('presente-regular: a multi-verb table (hablar/comer/vivir) gives one cell per person x verb', () => {
    const lesson = lessonFor('es', 'presente-regular')!;
    const cells = tableCellsForLesson(lesson);
    // 5 persons (vosotros dropped) x 3 verbs = 15.
    expect(cells).toHaveLength(15);
    expect(cells.find((c) => c.person === 'yo' && c.verb === 'hablar')?.answer).toBe('hablo');
    expect(cells.find((c) => c.person === 'yo' && c.verb === 'comer')?.answer).toBe('como');
  });

  it('deduplicates the same person+verb pair across two tables in one lesson', () => {
    const lesson = lessonFor('es', 'ser-estar')!;
    if (!isLessonV2(lesson)) throw new Error('ser-estar should be a schema-2 lesson');
    const tables = lesson.body.filter((b) => b.kind === 'table');
    const doubled = { ...lesson, body: [...lesson.body, ...tables] };
    expect(tableCellsForLesson(doubled)).toHaveLength(10);
  });

  // FB378: a table's optional `enPrompt` (English sentence per cell) carries
  // through to the cell the deck screen renders.
  it('carries a table\'s enPrompt through to the cell (indefinido-regular)', () => {
    const lesson = lessonFor('es', 'indefinido-regular')!;
    const cells = tableCellsForLesson(lesson);
    expect(cells.find((c) => c.person === 'yo' && c.verb === 'hablar')?.enPrompt).toBe('I spoke');
    expect(cells.find((c) => c.person === 'nosotros' && c.verb === 'escribir')?.enPrompt).toBe('we wrote');
  });

  it('a table without enPrompt leaves the cell field undefined (ser-estar)', () => {
    const lesson = lessonFor('es', 'ser-estar')!;
    const cells = tableCellsForLesson(lesson);
    expect(cells.every((c) => c.enPrompt === undefined)).toBe(true);
  });

  // FB390: interrogativos' table is a MEANING reference table (row[0] = "what",
  // "who", ... ; row[1] = the Spanish term), not a conjugation table, so it used
  // to give 0 table cells and fall back to the word-deck - where the question
  // words themselves are filtered out as closed-class (FUNCTION_WORDS_ES),
  // leaving only glossary::/example-sentence words like "prefieres".
  it('interrogativos: the meaning table gives a cell per question word, prompt = English meaning', () => {
    const lesson = lessonFor('es', 'interrogativos')!;
    const cells = tableCellsForLesson(lesson);
    expect(cells.length).toBeGreaterThanOrEqual(12);
    expect(cells.every((c) => c.id.startsWith('interrogativos::'))).toBe(true);
    // No glossary:: id leaked in from the word-deck fallback.
    expect(cells.some((c) => c.id.startsWith('glossary::'))).toBe(false);

    const what = cells.find((c) => c.enPrompt === 'what');
    expect(what?.answer).toBe('qué');
    const whoCell = cells.find((c) => c.enPrompt === 'who');
    expect(whoCell?.answer).toBe('quién');
    // No fake "infinitive" caption for a meaning cell (app/grammar/deck/[topic].tsx
    // only shows it when `verb` is non-empty).
    expect(cells.every((c) => c.verb === '')).toBe(true);
  });

  it('a reference table with a different header (Person, Singular, ...) still falls back to 0 cells, not forced', () => {
    const lesson = lessonFor('es', 'sustantivo-numero')!;
    expect(tableCellsForLesson(lesson)).toEqual([]);
  });
});

// FB377: the deck no longer walks the cells in table order (a fixed "yo ·
// ser" first taught the position, not the answer), it uses a seeded shuffle
// of lesson id + reset count instead. `order(lessonId, resetCount)` below
// recomputes that exact order with the same primitives the module uses, so
// these tests stay meaningful (and would catch a change to the shuffle
// itself) instead of hardcoding a sequence.
const LESSON_ID = 'ser-estar';
function order(lessonId: string, resetCount: number, ids: string[]): string[] {
  return shuffleArray(ids.slice().sort(), hashString(`${lessonId}:${resetCount}`));
}

describe('scheduling: initDeckState / nextCellId / answerCell / resetDeck', () => {
  const cells = tableCellsForLesson(lessonFor('es', LESSON_ID)!);
  const deckOrder = order(LESSON_ID, 0, cells.map((c) => c.id));

  it('starts every cell due now, in the seeded-shuffle order (not the table order)', () => {
    const state = initDeckState(cells, LESSON_ID);
    expect(state.cells).toHaveLength(10);
    expect(state.cells.map((c) => c.id)).toEqual(deckOrder);
    expect(state.cells.every((c) => !c.done && c.dueAt === null)).toBe(true);
    expect(nextCellId(state, 1000)).toBe(deckOrder[0]);
  });

  it('the same lesson id + reset count always gives the same order', () => {
    const a = initDeckState(cells, LESSON_ID);
    const b = initDeckState(cells, LESSON_ID);
    expect(a.cells.map((c) => c.id)).toEqual(b.cells.map((c) => c.id));
  });

  it('a different lesson id gives a different order', () => {
    const other = initDeckState(cells, 'presente-regular');
    expect(other.cells.map((c) => c.id)).not.toEqual(deckOrder);
  });

  it('a correct answer marks the cell done and moves on to the next one', () => {
    let state = initDeckState(cells, LESSON_ID);
    const now = 1_000_000;
    state = answerCell(state, deckOrder[0], true, now);
    expect(state.cells[0]).toEqual({ id: deckOrder[0], done: true, dueAt: null });
    expect(nextCellId(state, now)).toBe(deckOrder[1]);
    expect(doneCount(state)).toBe(1);
  });

  it('a wrong answer keeps the cell open and pushes it 60s into the future', () => {
    let state = initDeckState(cells, LESSON_ID);
    const now = 1_000_000;
    state = answerCell(state, deckOrder[0], false, now);
    expect(state.cells[0]).toEqual({ id: deckOrder[0], done: false, dueAt: now + 60_000 });
    // Not due yet -> the next fresh cell is shown, not the just-missed one.
    expect(nextCellId(state, now)).toBe(deckOrder[1]);
  });

  it('a wrong cell comes back once its cooldown has elapsed', () => {
    let state = initDeckState(cells, LESSON_ID);
    const now = 1_000_000;
    state = answerCell(state, deckOrder[0], false, now);
    expect(nextCellId(state, now + 59_999)).toBe(deckOrder[1]);
    expect(nextCellId(state, now + 60_000)).toBe(deckOrder[0]);
  });

  it('learn-ahead: if every remaining cell is a waiting wrong answer, shows the soonest one', () => {
    const two = cells.filter((c) => c.id === deckOrder[0] || c.id === deckOrder[1]);
    let state = initDeckState(two, LESSON_ID);
    const [firstId, secondId] = state.cells.map((c) => c.id);
    state = answerCell(state, firstId, false, 1000); // due at 61000
    state = answerCell(state, secondId, false, 2000); // due at 62000
    // Neither is due yet at t=3000, but the first one is sooner.
    expect(nextCellId(state, 3000)).toBe(firstId);
  });

  it('nextCellId is null once every cell is done, and isDeckComplete agrees', () => {
    let state = initDeckState(cells, LESSON_ID);
    const now = 1_000_000;
    for (const c of cells) state = answerCell(state, c.id, true, now);
    expect(nextCellId(state, now)).toBeNull();
    expect(isDeckComplete(state)).toBe(true);
    expect(doneCount(state)).toBe(cells.length);
  });

  it('an empty deck is not "complete" (nothing to celebrate)', () => {
    expect(isDeckComplete(initDeckState([], LESSON_ID))).toBe(false);
  });

  it('resetDeck clears every cell back to fresh, bumps resetCount, and reshuffles', () => {
    let state = initDeckState(cells, LESSON_ID);
    const now = 1_000_000;
    state = answerCell(state, deckOrder[0], true, now);
    state = answerCell(state, deckOrder[1], false, now);
    const fresh = resetDeck(state, LESSON_ID);
    expect(fresh.resetCount).toBe(1);
    expect(fresh.cells.every((c) => !c.done && c.dueAt === null)).toBe(true);
    expect(fresh.cells.map((c) => c.id).sort()).toEqual(deckOrder.slice().sort());
    expect(fresh.cells.map((c) => c.id)).toEqual(order(LESSON_ID, 1, deckOrder));
  });
});

describe('mergeDeckState', () => {
  const cells = tableCellsForLesson(lessonFor('es', LESSON_ID)!);
  const deckOrder = order(LESSON_ID, 0, cells.map((c) => c.id));

  it('with no persisted state, everything starts fresh', () => {
    const merged = mergeDeckState(cells, LESSON_ID, undefined);
    expect(merged.cells).toHaveLength(10);
    expect(merged.cells.map((c) => c.id)).toEqual(deckOrder);
    expect(merged.cells.every((c) => !c.done && c.dueAt === null)).toBe(true);
  });

  it('keeps a persisted cell state that still matches a current cell', () => {
    const persistedCells: DeckCellState[] = [{ id: deckOrder[0], done: true, dueAt: null }];
    const persisted: DeckState = { cells: persistedCells, resetCount: 0 };
    const merged = mergeDeckState(cells, LESSON_ID, persisted);
    expect(merged.cells.find((c) => c.id === deckOrder[0])).toEqual(persistedCells[0]);
    expect(doneCount(merged)).toBe(1);
  });

  it('drops a persisted cell the lesson no longer has, and starts an unseen cell fresh', () => {
    const persisted: DeckState = { cells: [{ id: 'stale-id-from-an-old-corpus', done: true, dueAt: null }], resetCount: 0 };
    const merged = mergeDeckState(cells, LESSON_ID, persisted);
    expect(merged.cells).toHaveLength(10);
    expect(doneCount(merged)).toBe(0);
  });

  it('carries the persisted reset count over, so the order matches that pass', () => {
    const persisted: DeckState = { cells: [], resetCount: 2 };
    const merged = mergeDeckState(cells, LESSON_ID, persisted);
    expect(merged.resetCount).toBe(2);
    expect(merged.cells.map((c) => c.id)).toEqual(order(LESSON_ID, 2, cells.map((c) => c.id)));
  });
});

// FB375 (PLAN-fb0923 6. lépés, D5/a): "itt is legyen egy nyelvtanulós kártya
// csomag a szavakból" - a word-deck a tábla nélküli leckéknek.
describe('wordCellsForLesson', () => {
  it('clases-de-palabras (no conjugation table): a non-empty deck with no function word', () => {
    const lesson = lessonFor('es', 'clases-de-palabras')!;
    expect(tableCellsForLesson(lesson)).toEqual([]); // ez a lecke pontosan azért kap szó-paklit
    const cards = wordCellsForLesson(lesson);
    expect(cards.length).toBeGreaterThan(0);
    const functionWords = ['el', 'la', 'los', 'las', 'un', 'una', 'y', 'o', 'pero', 'que', 'de', 'en', 'a', 'con', 'sin', 'yo', 'tú', 'me', 'te', 'se', 'su', 'este', 'esta'];
    for (const w of functionWords) {
      expect(cards.some((c) => c.es.toLowerCase() === w)).toBe(false);
    }
  });

  it('a sparse table-less lesson stays under the button threshold (D5, 3. lépés)', () => {
    const tiny: LessonV2 = {
      schema: 2,
      topic: 'zz-tiny-fixture',
      level: 'A1',
      title: { hu: 't', en: 't', es: 't', de: 't' },
      body: [{ kind: 'text', text: { hu: '', en: '', de: '', es: 'Hola. Adiós.' } }],
      speak: { hu: '', en: '', de: '', es: '' },
      items: [],
    };
    expect(wordCellsForLesson(tiny).length).toBeLessThan(WORD_DECK_MIN_CARDS);
  });
});
