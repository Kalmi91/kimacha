import presenteRegular from '@/data/games/grammar/es/presente-regular.json';
import hayEstar from '@/data/games/grammar/es/hay-estar.json';
import serEstar from '@/data/games/grammar/es/ser-estar.json';
import verbosReflexivos from '@/data/games/grammar/es/verbos-reflexivos.json';
import interrogativos from '@/data/games/grammar/es/interrogativos.json';
import sustantivoNumero from '@/data/games/grammar/es/sustantivo-numero.json';
import type { LessonV2 } from '../grammar/lessonTypes';
import { isConjugationTable, isMeaningTable, splitStemEnding, verbClassOf, verbColumnColor } from '../grammar/tableShape';

function tableBlock(lesson: unknown, id: string) {
  const body = (lesson as LessonV2).body;
  const block = body.find((b) => b.kind === 'table' && b.id === id);
  if (!block || block.kind !== 'table') throw new Error(`no table block "${id}"`);
  return block;
}

describe('verbClassOf', () => {
  it('reads the class off a regular infinitive', () => {
    expect(verbClassOf('hablar')).toBe('ar');
    expect(verbClassOf('comer')).toBe('er');
    expect(verbClassOf('vivir')).toBe('ir');
  });

  it('strips the reflexive "se" first', () => {
    expect(verbClassOf('levantarse')).toBe('ar');
  });

  it('is null for anything that is not an infinitive', () => {
    expect(verbClassOf('Significado')).toBeNull();
  });
});

describe('splitStemEnding', () => {
  it('splits a regular -ar/-er/-ir form into stem + ending', () => {
    expect(splitStemEnding('hablamos', 'hablar')).toEqual({ stem: 'habl', ending: 'amos' });
    expect(splitStemEnding('comemos', 'comer')).toEqual({ stem: 'com', ending: 'emos' });
    expect(splitStemEnding('vivimos', 'vivir')).toEqual({ stem: 'viv', ending: 'imos' });
  });

  it('keeps the accented ending as its own piece', () => {
    expect(splitStemEnding('habláis', 'hablar')).toEqual({ stem: 'habl', ending: 'áis' });
  });

  it('returns null for irregular forms, even when the naive prefix matches', () => {
    expect(splitStemEnding('soy', 'ser')).toBeNull();
    expect(splitStemEnding('tengo', 'tener')).toBeNull();
    expect(splitStemEnding('voy', 'ir')).toBeNull();
  });

  it('puts the reflexive pronoun before the stem, faint', () => {
    expect(splitStemEnding('me levanto', 'levantarse')).toEqual({ stem: 'me levant', ending: 'o' });
    expect(splitStemEnding('os ducháis', 'ducharse')).toEqual({ stem: 'os duch', ending: 'áis' });
  });

  it('returns null for a reflexive stem-change, whole form stays bold', () => {
    expect(splitStemEnding('me acuesto', 'acostarse')).toBeNull();
  });
});

// FB381-383: minden oszlop (ige) saját színt kap, index szerint, nem
// igeosztály szerint (tener/poder/hacer korábban egy színt kapott, mert
// mind -er végű, holott 3 külön ige).
describe('verbColumnColor', () => {
  it('gives four different columns four different colours, light and dark', () => {
    const light = [0, 1, 2, 3].map((i) => verbColumnColor(i, false));
    expect(new Set(light).size).toBe(4);
    const dark = [0, 1, 2, 3].map((i) => verbColumnColor(i, true));
    expect(new Set(dark).size).toBe(4);
  });

  it('wraps around past the palette length, deterministically', () => {
    const first = verbColumnColor(0, false);
    const wrapped = verbColumnColor(6, false);
    expect(wrapped).toBe(first);
  });
});

describe('isConjugationTable', () => {
  it('is true for presente-regular (Persona | hablar | comer | vivir)', () => {
    const block = tableBlock(presenteRegular, 'presente-regular');
    expect(isConjugationTable(block.header, block.rows)).toBe(true);
  });

  it('is true for a single-verb conjugation table (Persona | estar)', () => {
    const block = tableBlock(serEstar, 'estar-presente');
    expect(isConjugationTable(block.header, block.rows)).toBe(true);
  });

  it('is true for reflexivos-presente (Persona | levantarse | ducharse | acostarse)', () => {
    const block = tableBlock(verbosReflexivos, 'reflexivos-presente');
    expect(isConjugationTable(block.header, block.rows)).toBe(true);
  });

  it('is false for a reference table (hay/estar)', () => {
    const block = tableBlock(hayEstar, 'hay-estar-articulo');
    expect(isConjugationTable(block.header, block.rows)).toBe(false);
  });
});

// FB390: header[0].en === "Meaning" is the (deliberately narrow) signal for
// a quizzable "English meaning -> Spanish term" reference table.
describe('isMeaningTable', () => {
  it('is true for interrogativos (Meaning | Question word | ...)', () => {
    const block = tableBlock(interrogativos, 'interrogativos');
    expect(isMeaningTable(block.header, block.rows)).toBe(true);
  });

  it('is false for a conjugation table (presente-regular)', () => {
    const block = tableBlock(presenteRegular, 'presente-regular');
    expect(isMeaningTable(block.header, block.rows)).toBe(false);
  });

  it('is false for a reference table with a different header (hay/estar: "What follows")', () => {
    const block = tableBlock(hayEstar, 'hay-estar-articulo');
    expect(isMeaningTable(block.header, block.rows)).toBe(false);
  });

  it('is false for a reference table with a different header (sustantivo-numero: "Singular")', () => {
    const block = tableBlock(sustantivoNumero, 'plural');
    expect(isMeaningTable(block.header, block.rows)).toBe(false);
  });
});
