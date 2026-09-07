// The `gender` annotation on a word entry is the gender of its SPANISH
// headword, so reading it on a German course teaches the wrong thing ("a só" is
// annotated 'f' from "la sal", but German has "das Salz"). genderOf resolves the
// gender per target language instead; these tests pin that behaviour and the
// article data it reads.

import { genderOf, getWordsForLevel, words, type WordEntry } from '@/data/words';

const byGerman = (de: string): WordEntry | undefined => words.find((w) => w.de === de);

describe('genderOf', () => {
  it('keeps the annotated gender for Spanish', () => {
    const salt = byGerman('das Salz');
    expect(salt?.gender).toBe('f'); // la sal
    expect(genderOf(salt, 'es')).toBe('f');
  });

  it('reads German gender off the article, not off the Spanish annotation', () => {
    expect(genderOf(byGerman('das Salz'), 'de')).toBe('n');
    expect(genderOf(byGerman('der Reisepass'), 'de')).toBe('m');
    expect(genderOf(byGerman('die Wassermelone'), 'de')).toBe('f');
  });

  it('gives no gender where the German headword carries no article', () => {
    expect(genderOf(byGerman('schreiben'), 'de')).toBeUndefined();
  });

  it('does not read plural "die" as feminine', () => {
    const plural = words.find(
      (w) => /^die\s/i.test(w.de) && /^(los|las)\s/i.test(w.es)
    );
    expect(plural).toBeDefined();
    expect(genderOf(plural, 'de')).toBeUndefined();
  });

  it('gives no gender for targets that do not mark one', () => {
    const word = getWordsForLevel('A1', 'en')[0];
    expect(genderOf(word, 'en')).toBeUndefined();
    expect(genderOf(word, 'hu')).toBeUndefined();
  });

  it('is safe on a missing word', () => {
    expect(genderOf(undefined, 'de')).toBeUndefined();
  });

  it('never yields a neuter on the Spanish target, which has none', () => {
    expect(words.every((w) => genderOf(w, 'es') !== 'n')).toBe(true);
  });
});
