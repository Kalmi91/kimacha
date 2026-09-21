// FB357 (grammar:indefinido-10-verbos:drill), Kálmán 2026-09-21: "get rid of
// vosotros from exercises". Unit fixtures for isVosotrosItem/filterVosotros/
// filterVosotrosPairs, plus a couple of corpus-anchored checks (the real
// indefinido-10-verbos lesson, and the two known false-positive words) so a
// future content edit can't silently reintroduce either failure mode.

import { filterVosotros, filterVosotrosPairs, isVosotrosItem } from '../vosotros';
import type { FormItem, MatchItem, TransformItem } from '../lessonTypes';
import type { GrammarGapItem, GrammarMarkItem } from '../../games/content';
import { grammarKindCounts } from '../../games/content';
import { buildGrammarRound } from '../../games/grammarChoice';
import { lessonFor } from '../syllabus';

const lang4 = (v: string) => ({ hu: v, en: v, es: v, de: v });

function formItem(person: string, answer: string): FormItem {
  return { kind: 'form', id: 'f1', verb: 'hablar', person, answer, table: 't1' };
}

function transformItem(answer: string, promptEs: string, accept?: string[]): TransformItem {
  return {
    kind: 'transform',
    id: 't1',
    tense: { from: 'presente', to: 'indefinido' },
    prompt: lang4(promptEs),
    answer,
    accept,
    wordIds: [],
    why: lang4('porque sí'),
  };
}

function gapItem(sentence: string, options: string[], correct: number): GrammarGapItem {
  return { id: 'g1', sentence, options, correct, why: lang4('w'), wrong: {}, examples: [] };
}

function markItem(sentence: string, answer: string): GrammarMarkItem {
  return { kind: 'mark', id: 'm1', sentence, target: 'verb', answer, why: lang4('w'), wrong: {}, examples: [] };
}

describe('isVosotrosItem', () => {
  it('form: true when person is vosotros', () => {
    expect(isVosotrosItem(formItem('vosotros', 'habláis'))).toBe(true);
  });

  it('form: true on a vosotros/vosotras slash variant', () => {
    expect(isVosotrosItem(formItem('vosotros/vosotras', 'os laváis'))).toBe(true);
  });

  it('form: false for another person', () => {
    expect(isVosotrosItem(formItem('tú', 'hablas'))).toBe(false);
  });

  it('transform: true when the answer itself is a vosotros conjugation', () => {
    expect(isVosotrosItem(transformItem('Mirasteis la película tarde.', 'Miráis la película tarde.'))).toBe(true);
  });

  it('transform: true when only accept spells out the vosotros pronoun', () => {
    // ir-a-infinitivo iai-tr-10 shape: the bare answer ("Vais a ir...") does
    // not end in a listed suffix, only `accept` names the pronoun.
    expect(
      isVosotrosItem(transformItem('¿Vais a ir el domingo?', '¿Vais el domingo?', ['¿Vosotros vais a ir el domingo?']))
    ).toBe(true);
  });

  it('transform: false for a nosotros item (no pronoun, no matching ending)', () => {
    expect(isVosotrosItem(transformItem('Hablamos con el profesor.', 'Hablamos con el profesor.', ['Nosotros hablamos con el profesor.']))).toBe(false);
  });

  it('transform: does not false-positive on "país" (futuro-simple fu-tr-13 shape)', () => {
    expect(isVosotrosItem(transformItem('Visitaré el país pronto.', 'Visito el país pronto.'))).toBe(false);
  });

  it('gap: true when the CORRECT option is a vosotros form', () => {
    expect(isVosotrosItem(gapItem('Vosotros ___ muy rápido.', ['habláis', 'hablamos'], 0))).toBe(true);
  });

  it('gap: false when vosotros is only a WRONG distractor (presente-regular pr-06 shape)', () => {
    expect(isVosotrosItem(gapItem('Ustedes ___ muy rápido.', ['hablan', 'habláis', 'hablamos'], 0))).toBe(false);
  });

  it('gap: false on a number option ending like "dieciséis" (numeros-hora-fecha nh-02 shape)', () => {
    expect(isVosotrosItem(gapItem('Son las ___.', ['dieciséis', 'diecisiete'], 0))).toBe(false);
  });

  it('gap: true when the sentence itself names the vosotros pronoun', () => {
    expect(isVosotrosItem(gapItem('Vosotros ___ el libro.', ['leéis', 'leemos'], 0))).toBe(true);
  });

  it('mark: true when the tap-answer is a vosotros form', () => {
    expect(isVosotrosItem(markItem('Vosotros coméis temprano.', 'coméis'))).toBe(true);
  });

  it('mark: false for an unrelated sentence', () => {
    expect(isVosotrosItem(markItem('Ellos comen temprano.', 'comen'))).toBe(false);
  });

  it('match and why items are never flagged by isVosotrosItem (handled elsewhere / out of scope)', () => {
    const match: MatchItem = { kind: 'match', id: 'ma1', pairs: [{ es: 'os escribo pronto', en: "I'll write to you all soon" }] };
    expect(isVosotrosItem(match)).toBe(false);
  });
});

describe('filterVosotros', () => {
  it('drops only the flagged items, keeps order', () => {
    const items = [formItem('tú', 'hablas'), formItem('vosotros', 'habláis'), formItem('yo', 'hablo')];
    expect(filterVosotros(items).map((i) => i.person)).toEqual(['tú', 'yo']);
  });
});

describe('filterVosotrosPairs', () => {
  it('drops the vosotros pair, keeps the rest (pronombres-oi oi-match-01 shape)', () => {
    const item: MatchItem = {
      kind: 'match',
      id: 'oi-match-01',
      pairs: [
        { es: 'le doy el libro', en: 'I give him/her the book' },
        { es: 'os escribo pronto', en: "I'll write to you all soon" },
        { es: 'nos cuenta historias', en: 'he/she tells us stories' },
      ],
    };
    const filtered = filterVosotrosPairs(item);
    expect(filtered.pairs.map((p) => p.es)).toEqual(['le doy el libro', 'nos cuenta historias']);
  });

  it('does not false-positive on a slash-listed suffix (comparativos-superlativos shape)', () => {
    const item: MatchItem = {
      kind: 'match',
      id: 'cs-match-01',
      pairs: [{ es: 'tanto/a/os/as ... como', en: 'as much/many ... as (noun)' }],
    };
    expect(filterVosotrosPairs(item).pairs).toHaveLength(1);
  });

  it('returns the same object when nothing is dropped', () => {
    const item: MatchItem = { kind: 'match', id: 'm', pairs: [{ es: 'le doy el libro', en: 'x' }] };
    expect(filterVosotrosPairs(item)).toBe(item);
  });
});

// Corpus-anchored: the real lesson this feedback was filed against.
describe('indefinido-10-verbos (real lesson)', () => {
  const lesson = lessonFor('es', 'indefinido-10-verbos');
  if (!lesson) throw new Error('indefinido-10-verbos lesson not found');

  it('drops exactly the 4 vosotros transform items out of 50', () => {
    const all = lesson.items as TransformItem[];
    expect(all).toHaveLength(50);
    expect(filterVosotros(all)).toHaveLength(46);
  });

  it('grammarKindCounts and buildGrammarRound agree on the filtered count', () => {
    const counts = grammarKindCounts(lesson);
    expect(counts.transform).toBe(46);
    const round = buildGrammarRound(lesson, 1).filter((r) => 'item' in r && r.item.kind === 'transform');
    expect(round).toHaveLength(46);
  });
});
