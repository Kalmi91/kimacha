// The tap-a-word hint (lib/sentenceHint.ts, BRIEF-B3): which words of the English prompt are tappable, what the bubble shows,
// and which learned cards a looked-at word belongs to. A fake lookup stands in for the words-open data.

import { glossForms, hintPieces, type HintLookup, type HintPiece } from '../sentenceHint';
import type { SentenceEntry } from '../sentenceTab';

const GLOSS: Record<string, string[]> = {
  yo: ['I'], estar: ['to be'], bien: ['well, fine'], el: ['the'], la: ['the'], libro: ['book'], mesa: ['table'], y: ['and'],
  no: ['no, not'], gracias: ['thank you'], sí: ['yes'], querer: ['to want, to love (someone)'], un: ['a, an'], coche: ['car'],
};
const LEMMAS: Record<string, string[]> = {
  s1: ['yo', 'estar', 'bien'],
  s2: ['el', 'libro', 'y', 'la', 'mesa'],
  s3: ['no', 'no', 'estar', 'bien'],
  s4: ['sí', 'gracias', 'estar', 'bien'],
  s6: ['yo', 'querer', 'un', 'coche'],
};
const CARD_LEMMA: Record<string, string> = { 'o-bien': 'bien' };
const lookup: HintLookup = {
  sentenceLemmas: (id) => LEMMAS[id],
  glosses: (lemma) => GLOSS[lemma] ?? [],
  cardLemma: (id) => CARD_LEMMA[id],
};

const entry = (itemId: string, source: string, target: string, slots: SentenceEntry['slots'] = []): SentenceEntry => ({
  itemId, source, target, wordCount: 3, wordIds: slots.map((s) => s.id), due: false, dueIds: [], staleness: '', slots,
});
/** The tappable words as `word:es`, in sentence order. */
const tappable = (pieces: HintPiece[] | null) => (pieces ?? []).flatMap((p) => (p.hint ? [`${p.text}:${p.hint.es}`] : []));

describe('glossForms', () => {
  it('alternatives are split, notes in parentheses dropped, lowercase, no punctuation, to/the/a/an cut', () => {
    expect(glossForms('well, fine')).toEqual([['well'], ['fine']]);
    expect(glossForms('to want, to love (someone)')).toEqual([['want'], ['love']]);
    expect(glossForms('you (informal)')).toEqual([['you']]);
    expect(glossForms('The Book')).toEqual([['book']]);
    expect(glossForms('a, an')).toEqual([['a'], ['an']]); // a lone filler word stays
    expect(glossForms('to (direction, recipient)')).toEqual([['to']]);
    expect(glossForms('thank you')).toEqual([['thank', 'you']]); // several words
    expect(glossForms('in, on (a surface), at')).toEqual([['in'], ['on'], ['at']]);
    expect(glossForms('')).toEqual([]);
  });
});

describe('hintPieces', () => {
  it('the words that are a gloss of a sentence lemma are tappable, the Spanish form is the one in the sentence', () => {
    const pieces = hintPieces(entry('s1', 'I am fine.', 'Yo estoy bien.'), lookup);
    expect(tappable(pieces)).toEqual(['I:yo', 'fine:bien']); // "am" is not the gloss of "to be": nothing to tap
    expect(pieces!.map((p) => p.text).join('')).toBe('I am fine.'); // the pieces are the sentence, punctuation and spaces included
    expect(pieces!.filter((p) => p.hint).map((p) => p.hint!.index)).toEqual([0, 2]); // the word's place in the sentence
  });

  it('a repeated word is paired in order: the first "the" with the first article, the second with the second', () => {
    expect(tappable(hintPieces(entry('s2', 'The book and the table.', 'El libro y la mesa.'), lookup))).toEqual([
      'The:el', 'book:libro', 'and:y', 'the:la', 'table:mesa',
    ]);
  });

  it('a lemma twice in the sentence takes two places; an alternative of the gloss counts ("no, not")', () => {
    expect(tappable(hintPieces(entry('s3', 'No, I am not fine.', 'No, no estoy bien.'), lookup))).toEqual(['No:no', 'not:no', 'fine:bien']);
  });

  it('a gloss of several words: every word of it is tappable and shows the same Spanish word', () => {
    const pieces = hintPieces(entry('s4', 'Yes, thank you, I am fine.', 'Sí, gracias, estoy bien.'), lookup);
    expect(tappable(pieces)).toEqual(['Yes:sí', 'thank:gracias', 'you:gracias', 'fine:bien']);
    expect(pieces!.filter((p) => p.hint).map((p) => p.hint!.index)).toEqual([0, 1, 2, 5]);
  });

  it('"a" / "an" are the gloss of "un"; the sentence\'s first word comes lowercased', () => {
    expect(tappable(hintPieces(entry('s6', 'I want a car.', 'Yo quiero un coche.'), lookup))).toEqual(['I:yo', 'want:quiero', 'a:un', 'car:coche']);
  });

  it('the sentence words do not line up with the lemma list: the bubble shows the lemma', () => {
    // 3 Spanish words for 4 lemmas: "querer", not "quiero"
    expect(tappable(hintPieces(entry('s6', 'I want a car.', 'Quiero un coche.'), lookup))).toEqual(['I:yo', 'want:querer', 'a:un', 'car:coche']);
  });

  it('ids: the learned cards that own the Spanish word, by token or by the card\'s lemma; none when nobody owns it', () => {
    const slots = [{ id: 'a1-w1', words: ['estoy'] }, { id: 'o-bien', words: ['xyz'] }];
    const pieces = hintPieces(entry('s1', 'I am fine.', 'Yo estoy bien.', slots), lookup)!;
    const byWord = Object.fromEntries(pieces.filter((p) => p.hint).map((p) => [p.text, p.hint!.ids]));
    expect(byWord).toEqual({ I: [], fine: ['o-bien'] }); // "bien" through the card's lemma; "yo" is owned by nobody
    const token = hintPieces(entry('s1', 'I am fine.', 'Yo estoy bien.', [{ id: 'a1-w9', words: ['yo', 'bien'] }]), lookup)!;
    expect(token.filter((p) => p.hint).map((p) => p.hint!.ids)).toEqual([['a1-w9'], ['a1-w9']]);
  });

  it('nothing to tap -> null: no lemma data, a mistake sentence, no gloss in the sentence', () => {
    expect(hintPieces(entry('unknown', 'I am fine.', 'Yo estoy bien.'), lookup)).toBeNull();
    expect(hintPieces({ ...entry('s1', 'I am fine.', 'Yo estoy bien.'), mistake: { wrong: 'x' } }, lookup)).toBeNull();
    expect(hintPieces(entry('s1', 'Everything is great.', 'Yo estoy bien.'), lookup)).toBeNull();
  });
});

describe('with the real words-open data', () => {
  it('the first A1 sentence ("I am fine.") has its tappable words', () => {
    const pieces = hintPieces(entry('o3', 'I am fine.', 'Yo estoy bien.'));
    expect(pieces).not.toBeNull();
    const fine = pieces!.find((p) => p.text === 'fine');
    expect(fine?.hint).toMatchObject({ es: 'bien', lemma: 'bien' });
  });

  it('an item with no words-open entry (another id space) has none', () => {
    expect(hintPieces(entry('a1-w1', 'The book.', 'El libro.'))).toBeNull();
  });
});
