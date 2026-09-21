import presenteRegular from '@/data/games/grammar/es/presente-regular.json';
import hayEstar from '@/data/games/grammar/es/hay-estar.json';
import serEstar from '@/data/games/grammar/es/ser-estar.json';
import verbosReflexivos from '@/data/games/grammar/es/verbos-reflexivos.json';
import type { LessonV2 } from '../grammar/lessonTypes';
import { isConjugationTable, splitStemEnding, verbClassOf } from '../grammar/tableShape';

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
