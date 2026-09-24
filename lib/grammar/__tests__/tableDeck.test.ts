// PLAN-play 13. lépés (s6): pure-logic tests for the table-deck (Anki-style
// practice built from a lesson's conjugation tables). Uses the real lesson
// data (ser-estar, presente-regular, hay-estar) so a corpus change that
// breaks the deck is caught here, not just in a hand-rolled fixture.

import { lessonFor } from '../syllabus';
import { isLessonV2 } from '../../games/content';
import type { LessonV2 } from '../lessonTypes';
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
});

describe('scheduling: initDeckState / nextCellId / answerCell / resetDeck', () => {
  const cells = tableCellsForLesson(lessonFor('es', 'ser-estar')!);

  it('starts every cell due now, in the deck order', () => {
    const state = initDeckState(cells);
    expect(state.cells).toHaveLength(10);
    expect(state.cells.every((c) => !c.done && c.dueAt === null)).toBe(true);
    expect(nextCellId(state, 1000)).toBe(cells[0].id);
  });

  it('a correct answer marks the cell done and moves on to the next one', () => {
    let state = initDeckState(cells);
    const now = 1_000_000;
    state = answerCell(state, cells[0].id, true, now);
    expect(state.cells[0]).toEqual({ id: cells[0].id, done: true, dueAt: null });
    expect(nextCellId(state, now)).toBe(cells[1].id);
    expect(doneCount(state)).toBe(1);
  });

  it('a wrong answer keeps the cell open and pushes it 60s into the future', () => {
    let state = initDeckState(cells);
    const now = 1_000_000;
    state = answerCell(state, cells[0].id, false, now);
    expect(state.cells[0]).toEqual({ id: cells[0].id, done: false, dueAt: now + 60_000 });
    // Not due yet -> the next fresh cell is shown, not the just-missed one.
    expect(nextCellId(state, now)).toBe(cells[1].id);
  });

  it('a wrong cell comes back once its cooldown has elapsed', () => {
    let state = initDeckState(cells);
    const now = 1_000_000;
    state = answerCell(state, cells[0].id, false, now);
    expect(nextCellId(state, now + 59_999)).toBe(cells[1].id);
    expect(nextCellId(state, now + 60_000)).toBe(cells[0].id);
  });

  it('learn-ahead: if every remaining cell is a waiting wrong answer, shows the soonest one', () => {
    const two = cells.slice(0, 2);
    let state = initDeckState(two);
    state = answerCell(state, two[0].id, false, 1000); // due at 61000
    state = answerCell(state, two[1].id, false, 2000); // due at 62000
    // Neither is due yet at t=3000, but the first one is sooner.
    expect(nextCellId(state, 3000)).toBe(two[0].id);
  });

  it('nextCellId is null once every cell is done, and isDeckComplete agrees', () => {
    let state = initDeckState(cells);
    const now = 1_000_000;
    for (const c of cells) state = answerCell(state, c.id, true, now);
    expect(nextCellId(state, now)).toBeNull();
    expect(isDeckComplete(state)).toBe(true);
    expect(doneCount(state)).toBe(cells.length);
  });

  it('an empty deck is not "complete" (nothing to celebrate)', () => {
    expect(isDeckComplete(initDeckState([]))).toBe(false);
  });

  it('resetDeck clears every cell back to fresh, in the same order', () => {
    let state = initDeckState(cells);
    const now = 1_000_000;
    state = answerCell(state, cells[0].id, true, now);
    state = answerCell(state, cells[1].id, false, now);
    const fresh = resetDeck(state);
    expect(fresh.cells.every((c) => !c.done && c.dueAt === null)).toBe(true);
    expect(fresh.cells.map((c) => c.id)).toEqual(state.cells.map((c) => c.id));
  });
});

describe('mergeDeckState', () => {
  const cells = tableCellsForLesson(lessonFor('es', 'ser-estar')!);

  it('with no persisted state, everything starts fresh', () => {
    const merged = mergeDeckState(cells, undefined);
    expect(merged.cells).toHaveLength(10);
    expect(merged.cells.every((c) => !c.done && c.dueAt === null)).toBe(true);
  });

  it('keeps a persisted cell state that still matches a current cell', () => {
    const persisted: DeckCellState[] = [{ id: cells[0].id, done: true, dueAt: null }];
    const merged = mergeDeckState(cells, persisted);
    expect(merged.cells.find((c) => c.id === cells[0].id)).toEqual(persisted[0]);
    expect(doneCount(merged)).toBe(1);
  });

  it('drops a persisted cell the lesson no longer has, and starts an unseen cell fresh', () => {
    const persisted: DeckCellState[] = [{ id: 'stale-id-from-an-old-corpus', done: true, dueAt: null }];
    const merged = mergeDeckState(cells, persisted);
    expect(merged.cells).toHaveLength(10);
    expect(doneCount(merged)).toBe(0);
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
