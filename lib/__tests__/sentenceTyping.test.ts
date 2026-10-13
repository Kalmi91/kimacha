// The typed sentence, word by word: a learned word typed right is right even when the rest of the answer is wrong; a
// left-out subject pronoun and the optional (parenthesized) part are not errors; accents follow the strict switch.

import type { SentenceEntry } from '@/lib/sentenceTab';
import { gradeTypedWords, type WordVerdict } from '@/lib/sentenceTyping';

const entry = (target: string, slots: Array<[string, string[]]>, dueIds: string[] = []): SentenceEntry => ({
  itemId: 'x',
  source: '',
  target,
  wordCount: target.split(/\s+/).length,
  wordIds: slots.map(([id]) => id),
  due: dueIds.length > 0,
  dueIds,
  staleness: '',
  slots: slots.map(([id, words]) => ({ id, words })),
});

const rightIds = (v: WordVerdict[]) => v.filter((x) => x.right).map((x) => x.id);
const wrongIds = (v: WordVerdict[]) => v.filter((x) => !x.right).map((x) => x.id);

// "Yo como pan y bebo agua." with a card per content word (the pronoun too)
const COMER = entry(
  'Yo como pan y bebo agua.',
  [['yo', ['yo']], ['comer', ['como']], ['pan', ['pan']], ['beber', ['bebo']], ['agua', ['agua']]],
  ['pan', 'agua'],
);

describe('gradeTypedWords', () => {
  it('the whole sentence right: every learned word right', () => {
    const v = gradeTypedWords('Yo como pan y bebo agua.', COMER, 'es');
    expect(rightIds(v)).toEqual(['yo', 'comer', 'pan', 'beber', 'agua']);
    expect(wrongIds(v)).toEqual([]);
  });

  it('a partly right sentence: the right words are right, the wrong one is wrong (and says whether it is due)', () => {
    const v = gradeTypedWords('yo como pan y bebo leche', COMER, 'es');
    expect(rightIds(v)).toEqual(['yo', 'comer', 'pan', 'beber']);
    expect(v.find((x) => x.id === 'agua')).toEqual({ id: 'agua', right: false, due: true });
    expect(v.find((x) => x.id === 'comer')).toMatchObject({ right: true, due: false });
  });

  it('a missing word is wrong; an extra word and the order do not matter to the others', () => {
    const missing = gradeTypedWords('yo como y bebo agua', COMER, 'es');
    expect(wrongIds(missing)).toEqual(['pan']);
    const extra = gradeTypedWords('yo como mucho pan y bebo agua fría', COMER, 'es');
    expect(wrongIds(extra)).toEqual([]);
  });

  it('a wrong form of the word is wrong (a word-final difference is not a typo)', () => {
    const v = gradeTypedWords('yo comes pan y bebo agua', COMER, 'es');
    expect(wrongIds(v)).toEqual(['comer']);
    expect(wrongIds(gradeTypedWords('yo como pan y bebo aguas', COMER, 'es'))).toEqual(['agua']);
  });

  it('the subject pronoun may be left out: it is not an error and earns nothing', () => {
    const v = gradeTypedWords('como pan y bebo agua', COMER, 'es');
    expect(v.map((x) => x.id)).toEqual(['comer', 'pan', 'beber', 'agua']);
    expect(wrongIds(v)).toEqual([]);
  });

  it('an empty answer: every word wrong', () => {
    const v = gradeTypedWords('', COMER, 'es');
    expect(rightIds(v)).toEqual([]);
    expect(v.map((x) => x.id)).toEqual(['yo', 'comer', 'pan', 'beber', 'agua']);
  });

  it('accents: a missing accent is right unless strict accents is on', () => {
    const e = entry('Mamá está aquí.', [['mama', ['mamá']], ['estar', ['está']], ['aqui', ['aquí']]]);
    expect(rightIds(gradeTypedWords('mama esta aqui', e, 'es', false))).toEqual(['mama', 'estar', 'aqui']);
    expect(rightIds(gradeTypedWords('mama esta aqui', e, 'es', true))).toEqual([]);
    expect(rightIds(gradeTypedWords('mamá está aquí', e, 'es', true))).toEqual(['mama', 'estar', 'aqui']);
    // a real spelling slip is wrong either way
    expect(wrongIds(gradeTypedWords('mamá esta aqi', e, 'es', false))).toEqual(['aqui']);
  });

  it('a card of several words is right only when all of them were typed', () => {
    const e = entry('Buenos días a todos.', [['saludo', ['buenos', 'días']], ['todos', ['todos']]]);
    expect(rightIds(gradeTypedWords('buenos dias a todos', e, 'es'))).toEqual(['saludo', 'todos']);
    expect(rightIds(gradeTypedWords('buenos a todos', e, 'es'))).toEqual(['todos']);
  });

  it('an optional (parenthesized) part: the answer with it or without it is graded against the closer form', () => {
    const e = entry('Quiero pan (blanco).', [['querer', ['quiero']], ['pan', ['pan']], ['blanco', ['blanco']]]);
    const without = gradeTypedWords('quiero pan', e, 'es');
    expect(without.map((x) => x.id)).toEqual(['querer', 'pan']); // "blanco" is not asked for
    expect(wrongIds(without)).toEqual([]);
    const withIt = gradeTypedWords('quiero pan blanco', e, 'es');
    expect(rightIds(withIt)).toEqual(['querer', 'pan', 'blanco']);
  });

  it('English: words right in a wrong sentence', () => {
    const e = entry('She reads a book.', [['read', ['reads']], ['book', ['book']]], ['book']);
    expect(rightIds(gradeTypedWords('she reads a pen', e, 'en'))).toEqual(['read']);
    expect(gradeTypedWords('she reads a pen', e, 'en').find((x) => x.id === 'book')).toEqual({ id: 'book', right: false, due: true });
    expect(rightIds(gradeTypedWords("She reads a book.", e, 'en'))).toEqual(['read', 'book']);
  });
});
