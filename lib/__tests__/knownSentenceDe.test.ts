// The "learned words only" gate for German: the forms a learned word stands for, the closed classes, names, numbers, separable
// verbs, and the tense gate by level (never a tense above the learner's level). Words are those of the German deck.

import { setActiveSource } from '@/lib/languagePair';
import { detachedPrefixes, isSentenceKnown, knownTokens, unknownTokens, type LearnedEntry } from '@/lib/knownSentence';
import type { DeLevel } from '@/lib/deForms';

afterEach(() => setActiveSource(null));

const verb = (text: string): LearnedEntry => ({ text, pos: 'verb' });
const noun = (text: string): LearnedEntry => ({ text, pos: 'noun' });
const adj = (text: string): LearnedEntry => ({ text, pos: 'adj' });
const ok = (sentence: string, learned: LearnedEntry[], level?: DeLevel) => isSentenceKnown(sentence, 'de', { learned, level });

describe('what a learned word stands for', () => {
  it('a verb: its present forms, the participle and the imperative, never another verb', () => {
    const known = knownTokens('de', { learned: [verb('gehen / fahren')] });
    for (const form of ['gehen', 'gehe', 'gehst', 'geht', 'fährst', 'fährt', 'gegangen', 'gefahren', 'fahr']) expect(known.has(form)).toBe(true);
    expect(known.has('ging')).toBe(false);
    expect(known.has('stehen')).toBe(false);
  });

  it('a noun: the plural and its dative from the data; only the singular where the data has no plural', () => {
    const known = knownTokens('de', { learned: [noun('das Kind'), noun('der Hund'), noun('der Zugführer')] });
    for (const form of ['kind', 'kinder', 'kindern', 'hund', 'hunde', 'hunden', 'zugführer']) expect(known.has(form)).toBe(true);
    expect(known.has('zugführern')).toBe(false);
    expect(known.has('hundes')).toBe(false); // the genitive is B1
    expect(knownTokens('de', { learned: [noun('der Hund')], level: 'B1' }).has('hundes')).toBe(true);
  });

  it('an adjective: the endings; the comparative and superlative from A2', () => {
    expect(knownTokens('de', { learned: [adj('groß')] }).has('großen')).toBe(true);
    expect(knownTokens('de', { learned: [adj('groß')] }).has('größer')).toBe(false);
    expect(knownTokens('de', { learned: [adj('groß')], level: 'A2' }).has('größer')).toBe(true);
    expect(ok('Ich habe ein neues Haus.', [verb('haben'), adj('neu'), noun('das Haus')])).toBe(true);
  });

  it('a phrase card is learned as written, its pronoun + verb teaches that verb (not the participle\'s verb)', () => {
    const known = knownTokens('de', { learned: [{ text: 'ich habe gegessen', pos: 'verb' }, { text: 'es tut mir leid', pos: 'phrase' }] });
    expect(known.has('gegessen')).toBe(true);
    expect(known.has('hat')).toBe(true); // ich habe > haben
    expect(known.has('isst')).toBe(false);
    expect(known.has('tue')).toBe(false); // es tut mir leid > leidtun, only split
  });

  it('a nominalised adjective and the time adverb of a day', () => {
    const known = knownTokens('de', { learned: [noun('der/die Angestellte'), noun('der Sonntag'), { text: 'zwei', pos: 'num' }] });
    expect(known.has('angestellten')).toBe(true);
    expect(known.has('sonntags')).toBe(true);
    expect(known.has('zweite')).toBe(true);
  });
});

describe('separable verbs', () => {
  const learned = [verb('aufstehen'), verb('trinken'), noun('das Wasser'), noun('das Buch'), noun('der Tisch'), noun('die Uhr'), { text: 'sieben', pos: 'num' }];

  it('a finite form is known only together with its detached prefix at the end of the clause', () => {
    expect(ok('Ich stehe um sieben Uhr auf.', learned)).toBe(true);
    expect(ok('Steh auf!', learned)).toBe(true);
    expect(ok('Ich stehe auf und trinke Wasser.', learned)).toBe(true);
    expect(ok('Wir hoffen, dass du aufstehst.', learned)).toBe(false); // hoffen is not learned
    expect(ok('Ich will aufstehen.', [...learned, verb('wollen')])).toBe(true);
    // "stehen" itself is not learned: the preposition "auf" in the middle of the clause is no detached prefix
    expect(ok('Das Buch steht auf dem Tisch.', learned)).toBe(false);
    expect(unknownTokens('Das Buch steht auf dem Tisch.', 'de', { learned })).toEqual(['steht']);
    expect(ok('Ich stehe.', learned)).toBe(false);
  });

  it('the clause-final words that can be a prefix', () => {
    expect([...detachedPrefixes('Ich stehe um sieben Uhr auf.')]).toContain('auf');
    expect([...detachedPrefixes('Das Buch steht auf dem Tisch.')]).not.toContain('auf');
    expect([...detachedPrefixes('Ich rufe an, wenn ich komme.')]).toContain('an');
    expect([...detachedPrefixes('Ich fange an zu arbeiten.')]).toContain('an');
  });
});

describe('free words: closed classes, names, numbers', () => {
  it('articles, pronouns, prepositions, contractions, conjunctions and question words are free', () => {
    expect(ok('Ich bin mit dem Mann im Haus.', [verb('sein'), noun('der Mann'), noun('das Haus')])).toBe(true);
    expect(ok('Wer kommt zum Essen und wohin gehen wir?', [verb('kommen'), verb('gehen'), noun('das Essen')])).toBe(true);
    expect(ok('Meine Mutter gibt uns ihr Brot.', [verb('geben'), noun('die Mutter'), noun('das Brot')])).toBe(true);
    expect(ok('Das ist mein Buch, nicht deins.', [verb('sein'), noun('das Buch')])).toBe(true);
  });

  it('a content word is never free: a capitalised noun is not a name', () => {
    expect(ok('Der Garten ist groß.', [verb('sein'), adj('groß')])).toBe(false);
    expect(unknownTokens('Der Garten ist groß.', 'de', { learned: [verb('sein'), adj('groß')] })).toEqual(['garten']);
  });

  it('the names of the corpus are free; other capitalised words are not', () => {
    expect(ok('Ich bin Anna.', [verb('sein')])).toBe(true);
    expect(ok('Ich bin Peter.', [verb('sein')])).toBe(true);
    expect(ok('Ich bin Klaus.', [verb('sein')])).toBe(false);
    expect(ok('Ich fahre nach Spanien.', [verb('fahren')])).toBe(true);
  });

  it('digits and compound cardinals', () => {
    expect(ok('Ich habe 3 Kinder.', [verb('haben'), noun('das Kind')])).toBe(true);
    expect(ok('Er ist einunddreißig.', [verb('sein'), { text: 'dreißig', pos: 'num' }])).toBe(true);
    expect(ok('Er ist einundvierzig.', [verb('sein'), { text: 'dreißig', pos: 'num' }])).toBe(false);
  });
});

describe('never a tense above the learner\'s level', () => {
  const work = [verb('arbeiten'), verb('haben'), verb('malen'), verb('essen'), verb('sein'), noun('der Vater'), noun('das Bild')];

  it('the preterite: sein / haben at A2, every other verb at B1 (the word itself is not known before)', () => {
    expect(ok('Mein Vater arbeitete.', work, 'A1')).toBe(false);
    expect(ok('Mein Vater arbeitete.', work, 'A2')).toBe(false);
    expect(ok('Mein Vater arbeitete.', work, 'B1')).toBe(true);
    expect(ok('Mein Vater war hier.', [...work, { text: 'hier', pos: 'adv' }], 'A1')).toBe(false);
    expect(ok('Mein Vater war hier.', [...work, { text: 'hier', pos: 'adv' }], 'A2')).toBe(true);
  });

  it('the perfect: the commonest verbs at A1, every verb at A2', () => {
    expect(ok('Mein Vater hat gearbeitet.', work, 'A1')).toBe(true);
    expect(ok('Mein Vater hat das Bild gemalt.', work, 'A1')).toBe(false);
    expect(ok('Mein Vater hat das Bild gemalt.', work, 'A2')).toBe(true);
  });

  it('the default level is A1', () => {
    expect(ok('Mein Vater hat das Bild gemalt.', work)).toBe(false);
    expect(ok('Mein Vater malt das Bild.', work)).toBe(true);
  });

  it('subjunctive II, the passive and the future: B1', () => {
    const more = [...work, verb('werden'), verb('bauen'), noun('das Haus')];
    expect(ok('Mein Vater würde das Haus bauen.', more, 'A2')).toBe(false);
    expect(ok('Mein Vater würde das Haus bauen.', more, 'B1')).toBe(true);
    expect(ok('Das Haus wird gebaut.', more, 'A2')).toBe(false);
    expect(ok('Das Haus wird gebaut.', more, 'B1')).toBe(true);
    expect(ok('Mein Vater wird das Haus bauen.', more, 'A2')).toBe(false);
    expect(ok('Mein Vater wird das Haus bauen.', more, 'B1')).toBe(true);
  });

  it('the other languages are not touched by the German level', () => {
    expect(isSentenceKnown('El perro duerme.', 'es', { learned: ['perro', 'duerme'], level: 'A1' })).toBe(true);
  });
});
