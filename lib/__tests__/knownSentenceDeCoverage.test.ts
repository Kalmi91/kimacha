// More German sentences pass the "learned words only" gate without ever admitting an unknown word: the other persons of a verb
// taught by a "pronoun + verb" phrase card, compounds made only of learned nouns, time-of-day adverbs, feminine person nouns.

import { dePhraseVerb } from '@/lib/deEntryForms';
import { isKnownCompound } from '@/lib/deCompounds';
import { isSentenceKnown, knownTokens, unknownTokens, type LearnedEntry } from '@/lib/knownSentence';

const noun = (text: string): LearnedEntry => ({ text, pos: 'noun' });
const ok = (sentence: string, learned: LearnedEntry[]) => isSentenceKnown(sentence, 'de', { learned });

describe('a pronoun + verb phrase card teaches its verb', () => {
  it('finds the infinitive behind the first finite verb', () => {
    expect(dePhraseVerb('ich habe')).toBe('haben');
    expect(dePhraseVerb('ich habe gegessen')).toBe('haben');
    expect(dePhraseVerb('man darf nicht')).toBe('dürfen');
    expect(dePhraseVerb('du arbeitest')).toBe('arbeiten');
    expect(dePhraseVerb('ich wandere')).toBe('wandern');
    expect(dePhraseVerb('ich lächle')).toBe('lächeln');
    expect(dePhraseVerb('ich studiere')).toBe('studieren');
    expect(dePhraseVerb('ich stehe auf')).toBe('aufstehen');
    expect(dePhraseVerb('es gibt keine')).toBe('geben');
  });

  it('is null for a phrase without a subject pronoun or without a verb', () => {
    expect(dePhraseVerb('guten Morgen')).toBeNull();
    expect(dePhraseVerb('ich auch')).toBeNull();
    expect(dePhraseVerb('ich')).toBeNull();
  });

  it('the other persons count, a different verb does not', () => {
    const learned: LearnedEntry[] = [{ text: 'ich habe', pos: 'verb' }, noun('das Buch')];
    expect(ok('Er hat ein Buch.', learned)).toBe(true);
    expect(ok('Du hast das Buch.', learned)).toBe(true);
    expect(unknownTokens('Er liest das Buch.', 'de', { learned })).toEqual(['liest']);
    expect(knownTokens('de', { learned }).has('hatte')).toBe(false); // the preterite is A2
    expect(knownTokens('de', { learned, level: 'A2' }).has('hatte')).toBe(true);
  });

  it('a participle in the phrase teaches only the auxiliary, not its own verb', () => {
    const known = knownTokens('de', { learned: [{ text: 'ich habe gegessen', pos: 'verb' }] });
    expect(known.has('hat')).toBe(true);
    expect(known.has('isst')).toBe(false);
  });

  it('an adjective card that also names an irregular verb teaches that verb', () => {
    const known = knownTokens('de', { learned: [{ text: 'liegend / liegen', pos: 'adj' }] });
    expect(known.has('liegt')).toBe(true);
    expect(known.has('stehen')).toBe(false);
  });
});

describe('noun compounds', () => {
  const learned = [noun('das Kind'), noun('das Zimmer'), noun('die Arbeit'), noun('der Tag'), noun('die Sonne'), noun('das Licht')];
  const known = knownTokens('de', { learned });

  it('are known when every part is a learned noun (plural, linking -s, dropped -e)', () => {
    for (const compound of ['kinderzimmer', 'arbeitszimmer', 'arbeitstag', 'sonnenlicht', 'sonnenzimmer', 'kinderarbeitstag']) expect(isKnownCompound(compound, known)).toBe(true);
  });

  it('are not known when a part is not learned, or is too short, or is on the denylist', () => {
    for (const compound of ['hundezimmer', 'kinderhaus', 'kindzi', 'zimmerhund']) expect(isKnownCompound(compound, known)).toBe(false);
    expect(isKnownCompound('sonntag', knownTokens('de', { learned: [noun('die Sonne'), noun('der Tag')] }))).toBe(false);
  });

  it('count in a sentence only when written as a noun (with a capital)', () => {
    expect(unknownTokens('Das Kinderzimmer.', 'de', { learned })).toEqual([]);
    expect(unknownTokens('Das kinderzimmer.', 'de', { learned })).toEqual(['kinderzimmer']);
  });
});

describe('other forms', () => {
  it('the time of day makes its adverb, from a noun inside an adverb or phrase card too', () => {
    expect(knownTokens('de', { learned: [{ text: 'morgen / der Morgen', pos: 'adv' }] }).has('morgens')).toBe(true);
    expect(knownTokens('de', { learned: [{ text: 'heute Nachmittag', pos: 'phrase' }] }).has('nachmittags')).toBe(true);
  });

  it('a masculine person noun makes its feminine form, a genitive on -s doubles the s', () => {
    const known = knownTokens('de', { learned: [noun('der Student'), noun('der Sänger'), noun('der Arzt'), noun('der Bus')], level: 'B1' });
    for (const form of ['studentin', 'studentinnen', 'sängerin', 'ärztin', 'ärztinnen', 'busses']) expect(known.has(form)).toBe(true);
    expect(knownTokens('de', { learned: [noun('das Haus')] }).has('hausin')).toBe(false);
  });

  it('separable prefixes of the deck (hinzu, zurecht, fern) split the verb', () => {
    expect(ok('Ich füge Zucker hinzu.', [{ text: 'hinzufügen', pos: 'verb' }, noun('der Zucker')])).toBe(true);
    expect(ok('Ich mache mich zurecht.', [{ text: 'sich zurechtmachen', pos: 'verb' }])).toBe(true);
  });
});
