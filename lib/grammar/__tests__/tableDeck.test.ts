// pure-logic tests for the table-deck (Anki-style
// practice built from a lesson's conjugation tables). Uses the real lesson
// data (ser-estar, presente-regular, hay-estar) so a corpus change that
// breaks the deck is caught here, not just in a hand-rolled fixture.

import { lessonFor } from '../syllabus';
import type { LessonV2 } from '../lessonTypes';
import { hashString, shuffleArray } from '../../shuffle';
import { normalizeWordToken } from '@/data/words';
import {
  answerCell,
  doneCount,
  initDeckState,
  isDeckComplete,
  mergeDeckState,
  nextCellId,
  resetDeckInOrder,
  resetDeckShuffled,
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
    const tables = lesson.body.filter((b) => b.kind === 'table');
    const doubled = { ...lesson, body: [...lesson.body, ...tables] };
    expect(tableCellsForLesson(doubled)).toHaveLength(10);
  });

  // a table's optional `enPrompt` (English sentence per cell) carries
  // through to the cell the deck screen renders.
  it('carries a table\'s enPrompt through to the cell (indefinido-regular)', () => {
    const lesson = lessonFor('es', 'indefinido-regular')!;
    const cells = tableCellsForLesson(lesson);
    expect(cells.find((c) => c.person === 'yo' && c.verb === 'hablar')?.enPrompt).toBe('I spoke');
    expect(cells.find((c) => c.person === 'nosotros' && c.verb === 'escribir')?.enPrompt).toBe('we wrote');
  });

  // ser-estar has an enPrompt now; posesivos (a reference table) is the one without.
  it('a table without enPrompt leaves the cell field undefined (posesivos)', () => {
    const lesson = lessonFor('es', 'posesivos')!;
    const cells = tableCellsForLesson(lesson);
    expect(cells.length).toBeGreaterThan(0);
    expect(cells.every((c) => c.enPrompt === undefined)).toBe(true);
  });

  // interrogativos' table is a MEANING reference table (row[0] = "what",
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

  // person tables (every row label is a personal pronoun,
  // the header is not all infinitives) are askable, so the word-deck fallback ("redundant words")
  // does not kick in.
  it('pronombres-oi: the Sujeto -> pronoun table gives 5 cells (vosotros left out), no word-deck fallback', () => {
    const lesson = lessonFor('es', 'pronombres-oi')!;
    const cells = tableCellsForLesson(lesson);
    expect(cells).toHaveLength(5);
    expect(cells.find((c) => c.person === 'yo')?.answer).toBe('me');
    expect(cells.find((c) => c.person === 'ellos/ellas/ustedes')?.answer).toBe('les');
    expect(cells.some((c) => c.person.toLowerCase().includes('vosotros'))).toBe(false);
  });

  it('ir-a-infinitivo: the Persona -> "ir a" table gives 5 cells', () => {
    const lesson = lessonFor('es', 'ir-a-infinitivo')!;
    const cells = tableCellsForLesson(lesson);
    expect(cells).toHaveLength(5);
    expect(cells.find((c) => c.person === 'nosotros')?.answer).toBe('vamos a');
  });

  it('a table in which not every row is a person (pronombres-od: me, te, lo, la...) is still not asked', () => {
    const lesson = lessonFor('es', 'pronombres-od')!;
    expect(tableCellsForLesson(lesson)).toEqual([]);
  });

  it('a reference table with a different header (Person, Singular, ...) still falls back to 0 cells, not forced', () => {
    const lesson = lessonFor('es', 'sustantivo-numero')!;
    expect(tableCellsForLesson(lesson)).toEqual([]);
  });
});

// Round 1 again comes in the table/source order
// (`tableOrder` = the cells' own array order); the shuffled order is the separate
// path of "Harder: shuffled" (resetDeckShuffled). `shuffledOrder(...)`
// below computes, with the same primary tool (seeded shuffle), the
// permutation that resetDeckShuffled MUST produce, so that these
// tests also catch the shuffle itself if it ever changed.
const LESSON_ID = 'ser-estar';
function shuffledOrder(lessonId: string, resetCount: number, ids: string[]): string[] {
  return shuffleArray(ids.slice().sort(), hashString(`${lessonId}:${resetCount}`));
}

describe('scheduling: initDeckState / nextCellId / answerCell / resetDeckInOrder / resetDeckShuffled', () => {
  const cells = tableCellsForLesson(lessonFor('es', LESSON_ID)!);
  const tableOrder = cells.map((c) => c.id);

  it('starts every cell due now, in the SOURCE (table) order, not shuffled', () => {
    const state = initDeckState(cells);
    expect(state.cells).toHaveLength(10);
    expect(state.cells.map((c) => c.id)).toEqual(tableOrder);
    expect(state.shuffled).toBe(false);
    expect(state.cells.every((c) => !c.done && c.dueAt === null)).toBe(true);
    expect(nextCellId(state, 1000)).toBe(tableOrder[0]);
  });

  it('initDeckState always gives the same (table) order, regardless of lesson id', () => {
    const a = initDeckState(cells);
    const b = initDeckState(cells);
    expect(a.cells.map((c) => c.id)).toEqual(tableOrder);
    expect(b.cells.map((c) => c.id)).toEqual(tableOrder);
  });

  it('a correct answer marks the cell done and moves on to the next one', () => {
    let state = initDeckState(cells);
    const now = 1_000_000;
    state = answerCell(state, tableOrder[0], true, now);
    expect(state.cells[0]).toEqual({ id: tableOrder[0], done: true, dueAt: null });
    expect(nextCellId(state, now)).toBe(tableOrder[1]);
    expect(doneCount(state)).toBe(1);
  });

  it('a wrong answer keeps the cell open and pushes it 60s into the future', () => {
    let state = initDeckState(cells);
    const now = 1_000_000;
    state = answerCell(state, tableOrder[0], false, now);
    expect(state.cells[0]).toEqual({ id: tableOrder[0], done: false, dueAt: now + 60_000 });
    // Not due yet -> the next fresh cell is shown, not the just-missed one.
    expect(nextCellId(state, now)).toBe(tableOrder[1]);
  });

  it('a wrong cell comes back once its cooldown has elapsed', () => {
    let state = initDeckState(cells);
    const now = 1_000_000;
    state = answerCell(state, tableOrder[0], false, now);
    expect(nextCellId(state, now + 59_999)).toBe(tableOrder[1]);
    expect(nextCellId(state, now + 60_000)).toBe(tableOrder[0]);
  });

  it('learn-ahead: if every remaining cell is a waiting wrong answer, shows the soonest one', () => {
    const two = cells.filter((c) => c.id === tableOrder[0] || c.id === tableOrder[1]);
    let state = initDeckState(two);
    const [firstId, secondId] = state.cells.map((c) => c.id);
    state = answerCell(state, firstId, false, 1000); // due at 61000
    state = answerCell(state, secondId, false, 2000); // due at 62000
    // Neither is due yet at t=3000, but the first one is sooner.
    expect(nextCellId(state, 3000)).toBe(firstId);
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

  it('resetDeckInOrder ("Start again") clears every cell back to fresh, in the SOURCE order, resetCount back to 0', () => {
    let state = initDeckState(cells);
    const now = 1_000_000;
    state = answerCell(state, tableOrder[0], true, now);
    state = answerCell(state, tableOrder[1], false, now);
    const fresh = resetDeckInOrder(cells);
    expect(fresh.shuffled).toBe(false);
    expect(fresh.resetCount).toBe(0);
    expect(fresh.cells.every((c) => !c.done && c.dueAt === null)).toBe(true);
    expect(fresh.cells.map((c) => c.id)).toEqual(tableOrder);
  });

  it('resetDeckInOrder returns to the table order even from a shuffled pass (not the shuffled order)', () => {
    const shuffled = resetDeckShuffled(cells, LESSON_ID, 0);
    const backToOrder = resetDeckInOrder(cells);
    expect(backToOrder.cells.map((c) => c.id)).toEqual(tableOrder);
    expect(backToOrder.cells.map((c) => c.id)).not.toEqual(shuffled.cells.map((c) => c.id));
  });

  // A case known from the earlier test (interrogativos): if a table has >= 2 cells,
  // the shuffle order actually differs from the table order (it does not
  // coincide with it by accident), as required.
  it('resetDeckShuffled ("Harder: shuffled") is a permutation of the same ids, not the table order, and bumps resetCount + shuffled', () => {
    const fresh = resetDeckShuffled(cells, LESSON_ID, 0);
    expect(fresh.resetCount).toBe(1);
    expect(fresh.shuffled).toBe(true);
    expect(fresh.cells.every((c) => !c.done && c.dueAt === null)).toBe(true);
    expect(fresh.cells.map((c) => c.id).sort()).toEqual(tableOrder.slice().sort());
    expect(fresh.cells.map((c) => c.id)).toEqual(shuffledOrder(LESSON_ID, 1, tableOrder));
    expect(fresh.cells.map((c) => c.id)).not.toEqual(tableOrder);
  });

  it('resetDeckShuffled keeps advancing the seed on consecutive shuffles', () => {
    const first = resetDeckShuffled(cells, LESSON_ID, 0);
    const second = resetDeckShuffled(cells, LESSON_ID, first.resetCount);
    expect(second.resetCount).toBe(2);
    expect(second.cells.map((c) => c.id)).toEqual(shuffledOrder(LESSON_ID, 2, tableOrder));
    expect(second.cells.map((c) => c.id)).not.toEqual(first.cells.map((c) => c.id));
  });
});

describe('mergeDeckState', () => {
  const cells = tableCellsForLesson(lessonFor('es', LESSON_ID)!);
  const tableOrder = cells.map((c) => c.id);

  it('with no persisted state at all, everything starts fresh IN THE TABLE ORDER (FB389 default)', () => {
    const merged = mergeDeckState(cells, LESSON_ID, undefined);
    expect(merged.cells).toHaveLength(10);
    expect(merged.shuffled).toBe(false);
    expect(merged.cells.map((c) => c.id)).toEqual(tableOrder);
    expect(merged.cells.every((c) => !c.done && c.dueAt === null)).toBe(true);
  });

  it('keeps a persisted cell state that still matches a current cell', () => {
    const persistedCells: DeckCellState[] = [{ id: tableOrder[0], done: true, dueAt: null }];
    const persisted: DeckState = { cells: persistedCells, resetCount: 0, shuffled: false };
    const merged = mergeDeckState(cells, LESSON_ID, persisted);
    expect(merged.cells.find((c) => c.id === tableOrder[0])).toEqual(persistedCells[0]);
    expect(doneCount(merged)).toBe(1);
  });

  it('drops a persisted cell the lesson no longer has, and starts an unseen cell fresh', () => {
    const persisted: DeckState = { cells: [{ id: 'stale-id-from-an-old-corpus', done: true, dueAt: null }], resetCount: 0, shuffled: false };
    const merged = mergeDeckState(cells, LESSON_ID, persisted);
    expect(merged.cells).toHaveLength(10);
    expect(doneCount(merged)).toBe(0);
  });

  it('a persisted shuffled=true state keeps the seeded shuffle order for its reset count', () => {
    const persisted: DeckState = { cells: [], resetCount: 2, shuffled: true };
    const merged = mergeDeckState(cells, LESSON_ID, persisted);
    expect(merged.resetCount).toBe(2);
    expect(merged.shuffled).toBe(true);
    expect(merged.cells.map((c) => c.id)).toEqual(shuffledOrder(LESSON_ID, 2, tableOrder));
  });

  // an old save, from BEFORE the `shuffled` field was introduced (only
  // `cells` + `resetCount`) - it must not throw, and must NOT silently
  // reorder an in-progress shuffled round to table order.
  it('a persisted state without the `shuffled` field (pre-FB389 save) defaults to shuffled=true, not a reorder', () => {
    const oldPersisted = { cells: [], resetCount: 0 } as unknown as DeckState;
    const merged = mergeDeckState(cells, LESSON_ID, oldPersisted);
    expect(merged.shuffled).toBe(true);
    expect(merged.cells.map((c) => c.id)).toEqual(shuffledOrder(LESSON_ID, 0, tableOrder));
  });
});

// "There should be a language-learning card
// pack made of the words here too" - the word-deck is for lessons without a table (no askable table).
// The deck is built ONLY from the words of the lesson's
// tables; glossary and example-sentence words do not count.
const LANG4 = { hu: 'x', en: 'x', es: 'x', de: 'x' };
const tableFixture = (rows: string[][], over: Partial<LessonV2> = {}): LessonV2 => ({
  schema: 2,
  topic: 'zz-table-fixture',
  level: 'A1',
  title: LANG4,
  body: [
    { kind: 'table', id: 't1', title: LANG4, header: [LANG4, LANG4], rows },
    { kind: 'text', text: { ...LANG4, es: 'Mi hermano tiene un perro y una ciudad.' } },
  ],
  speak: { hu: '', en: '', de: '', es: '' },
  items: [],
  ...over,
});
// The tokens of the lesson's table cells (the expected behaviour of tableWordKeys, written independently).
const tableTokens = (lesson: LessonV2): Set<string> => {
  const out = new Set<string>();
  for (const b of lesson.body) {
    if (b.kind !== 'table') continue;
    for (const row of b.rows) for (const cell of row) for (const t of cell.split(/[\s/+()]+/)) if (normalizeWordToken(t)) out.add(normalizeWordToken(t));
  }
  return out;
};

describe('wordCellsForLesson (only the table words)', () => {
  it('the deck of a table lesson is only table words: the glossary and sentence words are left out', () => {
    const lesson = tableFixture([['comer', 'el hablar'], ['tener', 'la comer']], {
      glossary: [
        { word: 'comer', gloss: { ...LANG4, en: 'to eat (glossary)' } },
        { word: 'zapato', gloss: { ...LANG4, en: 'shoe' } },
      ],
    });
    const cards = wordCellsForLesson(lesson);
    const es = cards.map((c) => c.es.toLowerCase());
    // table words: comer (with a glossary gloss), hablar, tener; "zapato" (glossary only) and the
    // sentence words (hermano, perro, ciudad) are not in it, nor are the articles.
    expect(es.sort()).toEqual(['comer', 'hablar', 'tener']);
    expect(cards.find((c) => c.es === 'comer')?.en).toBe('to eat (glossary)');
  });

  it('lesson without a table: 0 cards, even if it has a glossary and example sentences (no deck entry)', () => {
    const lesson = tableFixture([], {
      body: [{ kind: 'text', text: { ...LANG4, es: 'Mi hermano quiere comer, hablar y tener una ciudad.' } }],
      glossary: [{ word: 'comer', gloss: { ...LANG4, en: 'to eat' } }],
    });
    expect(wordCellsForLesson(lesson)).toEqual([]);
  });

  it('a table with no known word (only inflected forms): 0 cards, no crash', () => {
    const lesson = tableFixture([['soy', 'eres'], ['somos', 'son']]);
    expect(wordCellsForLesson(lesson)).toEqual([]);
  });

  it('real lessons: every card is a table word, and there is no card from non-table words', () => {
    for (const id of ['marcadores-temporales', 'marcadores-discursivos', 'subjuntivo-relativo']) {
      const lesson = lessonFor('es', id)!;
      const tokens = tableTokens(lesson as LessonV2);
      const cards = wordCellsForLesson(lesson);
      expect(cards.length).toBeGreaterThanOrEqual(WORD_DECK_MIN_CARDS);
      for (const c of cards) {
        expect(tokens.has(normalizeWordToken(c.es))).toBe(true);
      }
    }
  });

  // (articulos-genero again consists of the lesson's own words, as before; the nouns are only in the el / la exercise)
  it('articulos-genero and its peers lost the deck: they stay below the threshold, no entry (clases-de-palabras regained it with words moved to the lesson level)', () => {
    for (const id of ['articulos-genero', 'sustantivo-numero', 'hay-estar', 'pronombres-od']) {
      expect(wordCellsForLesson(lessonFor('es', id)).length).toBeLessThan(WORD_DECK_MIN_CARDS);
    }
    expect(wordCellsForLesson(lessonFor('es', 'clases-de-palabras')).length).toBeGreaterThanOrEqual(WORD_DECK_MIN_CARDS);
  });

  it('no word deck even on bad input', () => {
    expect(wordCellsForLesson(null)).toEqual([]);
    expect(wordCellsForLesson(undefined)).toEqual([]);
  });
});

// The non-existent forms of wrong options are not word cards.
describe('wordCellsForLesson: skipping non-existent forms', () => {
  it('the word deck of sustantivo-numero does not contain a "not a real form" card', () => {
    const { lessonFor } = require('../syllabus');
    const cells = wordCellsForLesson(lessonFor('es', 'sustantivo-numero'));
    expect(cells.some((c: { en: string }) => /real form/i.test(c.en))).toBe(false);
    expect(cells.some((c: { es: string }) => c.es === 'lápizes' || c.es === 'vezes')).toBe(false);
  });
});
