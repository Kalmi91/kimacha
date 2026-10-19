// The exercises of the indefinido-regular lesson used verbs and words that were not in the lesson's tables.
// The 20 missing verbs each got a one-verb table (tabbed block), the 20 most frequent missing words got a meaning table; the verb tables are in the
// lesson's table deck, with no vosotros card.
// FB518-519: the two word (meaning) tables stay in the lesson body and feed the word deck, but are not in the table deck (`noTableDeck`).

import { lessonFor } from '../syllabus';
import { tableCellsForLesson, wordCellsForLesson } from '../tableDeck';

const lesson = lessonFor('es', 'indefinido-regular');
if (!lesson) throw new Error('indefinido-regular must exist');
const cells = tableCellsForLesson(lesson);

const wordTable = (id: string) => {
  const block = lesson.body.find((b) => b.kind === 'table' && b.id === id);
  if (!block || block.kind !== 'table') throw new Error(`table ${id} must exist`);
  return block;
};

const NEW_VERBS = [
  'salir', 'llegar', 'empezar', 'cenar', 'comprar', 'buscar', 'recibir', 'cambiar', 'terminar', 'vender',
  'beber', 'ver', 'cerrar', 'romper', 'explicar', 'mandar', 'viajar', 'abrir', 'esperar', 'visitar',
];

const norm = (w: string) => w.toLowerCase().replace(/[¿?¡!.,;:()"«»]/g, '');

describe('indefinido-regular: the verbs and words of the drills are in the tables', () => {
  it('every one of the 20 added verbs has a one-verb table, and the six originals are still there', () => {
    const tables = lesson.body.filter((b) => b.kind === 'table');
    const verbHeaders = tables.flatMap((b) => (b.kind === 'table' && b.header.length === 2 ? [b.header[1].es] : []));
    expect(verbHeaders).toEqual(expect.arrayContaining(NEW_VERBS));
    const original = tables.filter((b) => b.kind === 'table' && b.header.length === 4);
    expect(original).toHaveLength(2);
  });

  it('the deck asks 5 persons for each added verb with an English prompt, no vosotros', () => {
    for (const v of NEW_VERBS) {
      const verbCells = cells.filter((c) => c.verb === v);
      expect(verbCells).toHaveLength(5);
      expect(verbCells.every((c) => typeof c.enPrompt === 'string' && c.enPrompt.length > 0)).toBe(true);
    }
    expect(cells.some((c) => /^vosotros/i.test(c.person))).toBe(false);
    expect(cells.find((c) => c.verb === 'ver' && c.person === 'ellos/ellas/ustedes')?.answer).toBe('vieron');
    expect(cells.find((c) => c.verb === 'buscar' && c.person === 'yo')?.answer).toBe('busqué');
  });

  it('the 20 most frequent missing words are a meaning table in the lesson body (English meaning -> Spanish word)', () => {
    const table = wordTable('indefinido-regular-words');
    expect(table.rows).toHaveLength(20);
    expect(table.noTableDeck).toBe(true);
    expect(table.rows.find((r) => r[0] === 'today')?.[1]).toBe('hoy');
    expect(table.rows.find((r) => r[0] === 'house, home')?.[1]).toBe('la casa');
  });

  it('the other 28 missing words are a second meaning table in the lesson body, the 20 of the first one are unchanged', () => {
    const table = wordTable('indefinido-regular-words-2');
    expect(table.rows).toHaveLength(28);
    expect(table.noTableDeck).toBe(true);
    expect(wordTable('indefinido-regular-words').rows).toHaveLength(20);
    const spanish = table.rows.map((r) => norm(r[1].replace(/^(el|la) /, '')));
    for (const w of [
      'café', 'padre', 'familia', 'hermano', 'día', 'hora', 'pequeño', 'teléfono', 'semana', 'frío',
      'enfermo', 'después', 'mañana', 'médico', 'profesor', 'clase', 'hotel', 'ventana', 'vez', 'película',
      'tren', 'domingo', 'vaso', 'concierto', 'lunes', 'enero', 'marzo', 'aeropuerto',
    ]) {
      expect(spanish).toContain(w);
    }
    expect(table.rows.find((r) => r[0] === 'airport')?.[1]).toBe('el aeropuerto');
  });

  it('the two word tables are not in the table deck, every deck card is a verb form (FB518-519)', () => {
    expect(cells.some((c) => c.id.startsWith('indefinido-regular-words'))).toBe(false);
    expect(cells.length).toBeGreaterThan(0);
    expect(cells.every((c) => c.verb !== '')).toBe(true);
  });

  it('the words of the two word tables are still in the word deck (hoy from the first, pequeño from the second)', () => {
    const words = wordCellsForLesson(lesson, 'es').map((c) => c.es.toLowerCase());
    expect(words).toContain('hoy');
    expect(words).toContain('pequeño');
  });

  // The PCIC stores the nouns with their article ("la madre"); the table cells hold the bare noun.
  it('the article nouns of the word tables are in the word deck with their article (la madre, el aeropuerto)', () => {
    const words = wordCellsForLesson(lesson, 'es').map((c) => c.es.toLowerCase());
    expect(words).toContain('la madre');
    expect(words).toContain('el aeropuerto');
  });

  it('no indefinido form used in the drills is missing from the tables', () => {
    const tableTokens = new Set<string>();
    for (const b of lesson.body) {
      if (b.kind !== 'table') continue;
      for (const row of b.rows) for (const cell of row) for (const t of cell.split(/[\s/+()]+/)) tableTokens.add(norm(t));
    }
    const texts: string[] = [];
    for (const raw of lesson.items) {
      const it = raw as unknown as Record<string, unknown>;
      const kind = (it.kind as string | undefined) ?? 'gap';
      if (kind === 'gap') {
        const g = it as unknown as { sentence: string; options: string[]; correct: number; examples?: string[] };
        texts.push(g.sentence.replace('___', g.options[g.correct]), ...(g.examples ?? []));
      } else if (kind === 'transform') {
        texts.push((it as { answer: string }).answer);
      } else if (kind === 'match') {
        for (const p of (it as unknown as { pairs: { es: string }[] }).pairs) texts.push(p.es);
      }
    }
    const NOT_VERBS = new Set(['café', 'qué', 'así', 'aquí', 'allí', 'mamá', 'papá', 'sí', 'está', 'once']);
    const FORM = /(é|aste|ó|amos|aron|í|iste|ió|imos|ieron)$/;
    const missing = new Set<string>();
    for (const t of texts) {
      for (const raw of t.split(/\s+/)) {
        const w = norm(raw);
        if (!w || NOT_VERBS.has(w) || !FORM.test(w) || w.length < 4) continue;
        if (!tableTokens.has(w)) missing.add(w);
      }
    }
    expect([...missing].sort()).toEqual([]);
  });
});
