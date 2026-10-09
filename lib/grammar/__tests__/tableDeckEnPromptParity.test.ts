// minden ragozó táblakártya az angol alakot kérdezi ("I used to eat"), nem a puszta
// "yo"-t; a spanyol főnévi igenév a súgó-gombra jelenik meg (lásd 91f9e4b, és
// app/grammar/deck/[topic].tsx). Paritás-teszt: nincs táblakártya enPrompt nélkül.

import { GRAMMAR_SYLLABUS, lessonFor } from '../syllabus';
import { tableCellsForLesson } from '../tableDeck';

// Referencia-táblák (névmás / birtokos): a kártya promptja "yo · <oszlop-címke>" (pl.
// "yo · Masculino singular"), teljes, nem a puszta személy, és nincs ige-alakja, amit angolul
// lehetne kérdezni ("my" / "me" nem ragozás).
const REFERENCE_TABLES = new Set(['posesivos', 'posesivos-tonicos', 'pronombres-oi', 'pronombres-preposicion']);

// Régi adat: az indefinido-irregular estar- és ser-táblája ugyanazt az angolt adja
// ("I was"). Nem ennek a hatóköre; külön tétel.
const KNOWN_AMBIGUOUS_LESSONS = new Set(['indefinido-irregular']);

const lessons = GRAMMAR_SYLLABUS.map((t) => t.id)
  .map((id) => ({ id, cells: tableCellsForLesson(lessonFor('es', id)) }))
  .filter((l) => l.cells.length > 0);

const tableOf = (cellId: string) => cellId.split('::')[0];

describe('table deck English prompts (FB463)', () => {
  it('finds the conjugation-table lessons', () => {
    expect(lessons.length).toBeGreaterThanOrEqual(25);
  });

  it('no conjugation table card is without an English prompt', () => {
    const missing = lessons.flatMap((l) =>
      l.cells.filter((c) => !REFERENCE_TABLES.has(tableOf(c.id)) && !c.enPrompt).map((c) => `${l.id}: ${c.id}`)
    );
    expect(missing).toEqual([]);
  });

  it('within a lesson no two cards share the same English prompt', () => {
    const dupes: string[] = [];
    for (const l of lessons) {
      if (KNOWN_AMBIGUOUS_LESSONS.has(l.id)) continue;
      const seen = new Map<string, string>();
      for (const c of l.cells) {
        if (!c.enPrompt) continue;
        const prev = seen.get(c.enPrompt);
        if (prev) dupes.push(`${l.id}: "${c.enPrompt}" ${prev} <> ${c.id}`);
        else seen.set(c.enPrompt, c.id);
      }
    }
    expect(dupes).toEqual([]);
  });

  it('imperfecto: yo + hablar asks "I used to speak", not the bare "yo"', () => {
    const cells = tableCellsForLesson(lessonFor('es', 'imperfecto')!);
    expect(cells.find((c) => c.person === 'yo' && c.verb === 'hablar')?.enPrompt).toBe('I used to speak');
    expect(cells.find((c) => c.person === 'tú' && c.verb === 'ir')?.enPrompt).toBe('you used to go');
  });

  it('spot checks across the tenses', () => {
    const en = (lesson: string, person: string, verb: string) =>
      tableCellsForLesson(lessonFor('es', lesson)!).find((c) => c.person === person && c.verb === verb)?.enPrompt;
    expect(en('presente-regular', 'yo', 'comer')).toBe('I eat');
    expect(en('futuro-simple', 'nosotros', 'poder')).toBe('we will be able to');
    expect(en('condicional-simple', 'yo', 'poder')).toBe('I could');
    expect(en('perfecto', 'tú', 'escribir')).toBe('you have written');
    expect(en('pluscuamperfecto', 'yo', 'volver')).toBe('I had returned');
    expect(en('subjuntivo-presente-forma', 'yo', 'ser')).toBe('that I be');
    expect(en('subjuntivo-imperfecto', 'yo', 'ser')).toBe('that I were');
    expect(en('imperativo-afirmativo', 'tú', 'decir')).toBe('say! (informal)');
    expect(en('imperativo-negativo', 'ustedes', 'ir')).toBe("don't go! (you all)");
  });
});
