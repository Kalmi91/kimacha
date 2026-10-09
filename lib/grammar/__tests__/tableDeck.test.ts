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

  // a személy-táblák (minden sor címkéje személy-névmás,
  // a fejléc nem csupa infinitivus) kérdezhetők, így a szó-pakli fallback ("felesleges szavak")
  // nem lép be.
  it('pronombres-oi: a Sujeto -> névmás tábla 5 cellát ad (vosotros kihagyva), nincs szó-pakli fallback', () => {
    const lesson = lessonFor('es', 'pronombres-oi')!;
    const cells = tableCellsForLesson(lesson);
    expect(cells).toHaveLength(5);
    expect(cells.find((c) => c.person === 'yo')?.answer).toBe('me');
    expect(cells.find((c) => c.person === 'ellos/ellas/ustedes')?.answer).toBe('les');
    expect(cells.some((c) => c.person.toLowerCase().includes('vosotros'))).toBe(false);
  });

  it('ir-a-infinitivo: a Persona -> "ir a" tábla 5 cellát ad', () => {
    const lesson = lessonFor('es', 'ir-a-infinitivo')!;
    const cells = tableCellsForLesson(lesson);
    expect(cells).toHaveLength(5);
    expect(cells.find((c) => c.person === 'nosotros')?.answer).toBe('vamos a');
  });

  it('egy tábla, amiben nem minden sor személy (pronombres-od: me, te, lo, la...), továbbra sem kérdezett', () => {
    const lesson = lessonFor('es', 'pronombres-od')!;
    expect(tableCellsForLesson(lesson)).toEqual([]);
  });

  it('a reference table with a different header (Person, Singular, ...) still falls back to 0 cells, not forced', () => {
    const lesson = lessonFor('es', 'sustantivo-numero')!;
    expect(tableCellsForLesson(lesson)).toEqual([]);
  });
});

// az 1. kör megint a tábla/forrás sorrendjében
// jön (`tableOrder` = a cellák saját tömb-sorrendje), a kevert sorrend a
// "Harder: shuffled" (resetDeckShuffled) külön útja. `shuffledOrder(...)`
// lent ugyanazzal az elsődleges eszközzel (seed-elt shuffle) számolja ki azt
// a permutációt, amit a resetDeckShuffled-nek adnia KELL, hogy ezek a
// tesztek magát a shuffle-t is elkapják, ha megváltozna.
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

  // A korábbi tesztből ismert eset (interrogativos): ha egy táblának >= 2 cellája
  // van, a shuffle sorrendje ténylegesen eltér a tábla-sorrendtől (nem
  // véletlenül egyezik meg vele), ahogy a terv kéri.
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

  // régi mentés, még a `shuffled` mező bevezetése ELŐTTről (csak
  // `cells` + `resetCount`) - ne dobjon hibát, és NE rendezze át hallgatólag
  // a folyamatban lévő shuffled kört a tábla-sorrendre.
  it('a persisted state without the `shuffled` field (pre-FB389 save) defaults to shuffled=true, not a reorder', () => {
    const oldPersisted = { cells: [], resetCount: 0 } as unknown as DeckState;
    const merged = mergeDeckState(cells, LESSON_ID, oldPersisted);
    expect(merged.shuffled).toBe(true);
    expect(merged.cells.map((c) => c.id)).toEqual(shuffledOrder(LESSON_ID, 0, tableOrder));
  });
});

// "itt is legyen egy nyelvtanulós kártya
// csomag a szavakból" - a word-deck a tábla nélküli (nem kérdezhető táblás) leckéknek.
// a pakli CSAK a lecke
// táblázatainak szavaiból épül, a szószedet és a példamondatok szavai nem számítanak.
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
// A lecke táblázat-celláinak tokenjei (a tableWordKeys elvárt működése, függetlenül írva).
const tableTokens = (lesson: LessonV2): Set<string> => {
  const out = new Set<string>();
  for (const b of lesson.body) {
    if (b.kind !== 'table') continue;
    for (const row of b.rows) for (const cell of row) for (const t of cell.split(/[\s/+()]+/)) if (normalizeWordToken(t)) out.add(normalizeWordToken(t));
  }
  return out;
};

describe('wordCellsForLesson (csak a tábla szavai)', () => {
  it('a táblás lecke paklija csak tábla-szó: a szószedet- és mondat-szavak kimaradnak', () => {
    const lesson = tableFixture([['comer', 'el hablar'], ['tener', 'la comer']], {
      glossary: [
        { word: 'comer', gloss: { ...LANG4, en: 'to eat (glossary)' } },
        { word: 'zapato', gloss: { ...LANG4, en: 'shoe' } },
      ],
    });
    const cards = wordCellsForLesson(lesson);
    const es = cards.map((c) => c.es.toLowerCase());
    // tábla-szavak: comer (szószedet-glosszával), hablar, tener; a "zapato" (csak szószedet) és a
    // mondat szavai (hermano, perro, ciudad) nincsenek benne, a névelők sem.
    expect(es.sort()).toEqual(['comer', 'hablar', 'tener']);
    expect(cards.find((c) => c.es === 'comer')?.en).toBe('to eat (glossary)');
  });

  it('tábla nélküli lecke: 0 kártya, akkor is, ha van szószedete és példamondata (nincs pakli-belépő)', () => {
    const lesson = tableFixture([], {
      body: [{ kind: 'text', text: { ...LANG4, es: 'Mi hermano quiere comer, hablar y tener una ciudad.' } }],
      glossary: [{ word: 'comer', gloss: { ...LANG4, en: 'to eat' } }],
    });
    expect(wordCellsForLesson(lesson)).toEqual([]);
  });

  it('egy tábla, amiben nincs ismert szó (csak ragozott alakok): 0 kártya, nincs crash', () => {
    const lesson = tableFixture([['soy', 'eres'], ['somos', 'son']]);
    expect(wordCellsForLesson(lesson)).toEqual([]);
  });

  it('valódi leckék: minden kártya tábla-szó, és a nem-táblás szavakból nincs kártya', () => {
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

  // (az articulos-genero ismét a lecke saját szavaiból áll, mint korábban; a főnevek csak az el / la feladatban vannak)
  it('articulos-genero és társai elvesztették a paklit: a küszöb alatt maradnak, nincs belépő (a clases-de-palabras a lecke szintjére került szavakkal visszanyerte)', () => {
    for (const id of ['articulos-genero', 'sustantivo-numero', 'hay-estar', 'pronombres-od']) {
      expect(wordCellsForLesson(lessonFor('es', id)).length).toBeLessThan(WORD_DECK_MIN_CARDS);
    }
    expect(wordCellsForLesson(lessonFor('es', 'clases-de-palabras')).length).toBeGreaterThanOrEqual(WORD_DECK_MIN_CARDS);
  });

  it('nincs szó-pakli rossz bemenetre sem', () => {
    expect(wordCellsForLesson(null)).toEqual([]);
    expect(wordCellsForLesson(undefined)).toEqual([]);
  });
});

// a rossz opciók nem létező alakjai nem szó-kártyák.
describe('wordCellsForLesson: nem létező alakok kihagyása', () => {
  it('a sustantivo-numero szó-paklija nem tartalmaz "not a real form" kártyát', () => {
    const { lessonFor } = require('../syllabus');
    const cells = wordCellsForLesson(lessonFor('es', 'sustantivo-numero'));
    expect(cells.some((c: { en: string }) => /real form/i.test(c.en))).toBe(false);
    expect(cells.some((c: { es: string }) => c.es === 'lápizes' || c.es === 'vezes')).toBe(false);
  });
});
