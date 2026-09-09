import { words, type Level } from '@/data/words';
import {
  STRUCTURE_LEVEL,
  STRUCTURE_TOPIC,
  detectStructures,
  filterLockedSentences,
  lockedStructuresIn,
  resetFormIndex,
  sentenceAllowed,
  structuresAboveLevel,
  unlockedStructures,
} from '../grammar/tenseGate';
import { GRAMMAR_SYLLABUS } from '../grammar/syllabus';

beforeEach(() => resetFormIndex());

describe('detectStructures', () => {
  it('names the compound tenses by their auxiliary and participle', () => {
    // FB196 kiváltó esete: „The clients have arrived" spanyol párja.
    expect([...detectStructures('Los clientes han llegado temprano hoy.')]).toContain('perfecto');
    expect([...detectStructures('¿No habías estado aquí antes?')]).toContain('pluscuamperfecto');
    expect([...detectStructures('Habré terminado el trabajo.')]).toContain('futuro_perfecto');
    expect([...detectStructures('Habría llegado antes.')]).toContain('condicional_perfecto');
  });

  it('reads the simple tenses off the conjugation engine', () => {
    expect([...detectStructures('Yo hablo español.')]).toContain('presente');
    expect([...detectStructures('Ayer comí en casa.')]).toContain('indefinido');
    expect([...detectStructures('Antes vivíamos aquí.')]).toContain('imperfecto');
    expect([...detectStructures('Mañana hablaré con él.')]).toContain('futuro');
    expect([...detectStructures('Yo viajaría más.')]).toContain('condicional');
  });

  it('does not mistake a noun for a verb form it happens to share', () => {
    // vino = bor ÉS venir múltja; entre = között ÉS entrar kötőmódja;
    // viaje = utazás ÉS viajar kötőmódja.
    expect(detectStructures('El vino es de España.').has('indefinido')).toBe(false);
    expect(detectStructures('El gato está entre la mesa y la silla.').has('subjuntivo_presente')).toBe(false);
    expect(detectStructures('Estoy emocionado por el viaje.').has('subjuntivo_presente')).toBe(false);
    expect(detectStructures('Compro el billete en la agencia de viajes.').has('subjuntivo_presente')).toBe(false);
  });

  it('separates a command from a subordinate subjunctive, they share the form', () => {
    expect([...detectStructures('Tome asiento, por favor.')]).toContain('imperativo');
    expect([...detectStructures('No seas tonto, escúchame.')]).toContain('imperativo');
    expect([...detectStructures('Espero que usted vea el problema.')]).toContain('subjuntivo_presente');
    expect(detectStructures('Espero que usted vea el problema.').has('imperativo')).toBe(false);
  });

  it('needs a trigger before it calls something a subjunctive', () => {
    expect([...detectStructures('No creo que él sepa la verdad.')]).toContain('subjuntivo_presente');
    expect(detectStructures('Tengo varios libros sobre este tema.').has('subjuntivo_presente')).toBe(false);
  });
});

describe('unlockedStructures', () => {
  it('always allows the present, it is the baseline', () => {
    expect(unlockedStructures('A0').has('presente')).toBe(true);
  });

  it('opens a structure once the learner is past the level that teaches it', () => {
    expect(unlockedStructures('A1').has('perfecto')).toBe(false); // A2-ben tanítjuk
    expect(unlockedStructures('B1').has('perfecto')).toBe(true);
  });

  it('opens it on the learner own level only after the lesson is done', () => {
    expect(unlockedStructures('A2').has('perfecto')).toBe(false);
    expect(unlockedStructures('A2', new Set([STRUCTURE_TOPIC.perfecto])).has('perfecto')).toBe(true);
  });

  it('points every structure at a topic the syllabus actually has', () => {
    const known = new Set(GRAMMAR_SYLLABUS.map((t) => t.id));
    for (const topic of Object.values(STRUCTURE_TOPIC)) expect(known.has(topic)).toBe(true);
  });
});

describe('sentenceAllowed (FB196 runtime gate)', () => {
  it('keeps an A2 perfect tense away from an A1 learner', () => {
    // Kálmán 2026-09-09: „megint a have arrived os mondatot teszed be pedig még
    // ezt a nyelvtani szerkezetet nem tanítottad".
    const sentence = 'Los clientes han llegado temprano hoy.';
    expect(sentenceAllowed(sentence, 'A1')).toBe(false);
    expect(lockedStructuresIn(sentence, 'A1')).toEqual(['perfecto']);
  });

  it('lets it through once the lesson is done, or the level is past', () => {
    const sentence = 'Los clientes han llegado temprano hoy.';
    expect(sentenceAllowed(sentence, 'A2', new Set(['perfecto']))).toBe(true);
    expect(sentenceAllowed(sentence, 'B1')).toBe(true);
  });

  it('never blocks a plain present-tense sentence', () => {
    expect(sentenceAllowed('El gato está en la mesa.', 'A0')).toBe(true);
  });
});

// FB196 korpusz-őr. A lista NEM engedmény, hanem ütközés-napló: ezek a mondatok
// olyan A2-es szókártyákhoz tartoznak, amik MAGUKAT a kötőmódi/összetett alakokat
// tanítják (`saber (sepa)`, `haber (hayas)`, `tener (tuviera)`), miközben a
// tanterv ugyanezt a nyelvtant B1-re teszi. A feloldás Kálmán döntése: vagy a
// kártyák mennek B1-be, vagy a kötőmód-lecke jön A2-be. Amíg ez nem dőlt el, a
// lista fagyasztva van: ami rajta van, az ismert, ami nincs, az hiba.
const KNOWN_CONFLICTS = new Set([
  3441, 3448, 3459, 3463, 3478, 3488, 3527, 3532, 3535, 3537, 3570, 3585, 3602,
  3606, 1916, 2049, 2133,
]);

describe('corpus grammar level', () => {
  it('keeps every example sentence inside the grammar its own level teaches', () => {
    const offenders: string[] = [];
    for (const w of words) {
      if (w.level === 'C2') continue; // befagyasztott készlet
      const sentence = String(w.sentence_es ?? '');
      if (!sentence) continue;
      const above = structuresAboveLevel(sentence, w.level as Level);
      if (above.length === 0) continue;
      if (KNOWN_CONFLICTS.has(w.id)) continue;
      offenders.push(`${w.level} ${w.id} [${above.join(',')}] ${sentence}`);
    }
    expect(offenders).toEqual([]);
  });

  it('does not let the conflict list rot: every entry still conflicts', () => {
    const byId = new Map(words.map((w) => [w.id, w]));
    const stale: number[] = [];
    for (const id of KNOWN_CONFLICTS) {
      const w = byId.get(id);
      if (!w) continue;
      if (structuresAboveLevel(String(w.sentence_es ?? ''), w.level as Level).length === 0) stale.push(id);
    }
    expect(stale).toEqual([]);
  });

  it('covers every structure with a teaching level', () => {
    for (const key of Object.keys(STRUCTURE_TOPIC)) {
      expect(STRUCTURE_LEVEL[key as keyof typeof STRUCTURE_LEVEL]).toBeTruthy();
    }
  });
});

describe('filterLockedSentences', () => {
  const item = (type: string, sentence_es: string) => ({ type, word: { sentence_es } });

  it('drops a sentence card whose grammar is still locked, keeps the word cards', () => {
    const items = [
      item('word', 'Los clientes han llegado temprano hoy.'),
      item('sentence', 'Los clientes han llegado temprano hoy.'),
      item('sentence', 'El gato está en la mesa.'),
    ];
    const kept = filterLockedSentences(items, 'A1');
    expect(kept).toHaveLength(2);
    expect(kept[0].type).toBe('word'); // a szókártya megmarad, csak a mondat esik ki
    expect(kept[1].word.sentence_es).toBe('El gato está en la mesa.');
  });

  it('keeps everything once the lesson unlocks the structure', () => {
    const items = [item('sentence', 'Los clientes han llegado temprano hoy.')];
    expect(filterLockedSentences(items, 'A2', new Set(['perfecto']))).toHaveLength(1);
  });

  it('leaves a sentence with no text alone instead of guessing', () => {
    expect(filterLockedSentences([{ type: 'sentence', word: {} }], 'A0')).toHaveLength(1);
  });
});
