// The practice games on every one of the 12 language pairs, German included (as the learned language and as the learner's own).
// The cards are small hand-made fixtures (test-utils/germanDeck.ts: three genders, umlauts, ß, a bracketed gloss, an alternative,
// a plural-only noun), so the test does not depend on how far the generated German deck (data/words/de) or the German meanings
// of the other decks are. The games read the card, the learned language and the active source language, nothing else.

import type { PcicItem, PcicTarget } from '@/data/pcic';
import { setPcicTarget } from '@/data/pcic';
import { knownTokens } from '@/lib/knownSentence';
import { activeSourceFor, type Lang } from '@/lib/languagePair';
import { exampleIn, firstForm, wordIn } from '@/lib/pcicItemText';
import { learnedEntries } from '@/lib/sentenceCards';
import { sm2NewCard, type Sm2Card } from '@/lib/sm2';
import { GERMAN_DECK_ROWS } from '@/test-utils/germanDeck';
import { dictationWord, isDictationRight } from '../dictation';
import { gapTaskFor } from '../gapFill';
import { boardColumns, buildBoards, isMatchUsable, matchCard } from '../match';
import { isOppositesUsable } from '../opposites';
import { READING_WORDS, buildReadingSet, meaningOf, readingWordFor } from '../reading';
import { isScrambleUsable, scrambleTiles, scrambleWord, seedOf } from '../scramble';

const LANGS: Lang[] = ['en', 'es', 'hu', 'de'];
const PAIRS = LANGS.flatMap((source) => LANGS.filter((target) => target !== source).map((target) => ({ source, target })));
const TODAY = '2026-11-02';

const ITEMS: PcicItem[] = GERMAN_DECK_ROWS.map((r, i) => ({
  id: `t${i + 1}`,
  es: r.es,
  en: r.en,
  hu: r.hu,
  de: r.de,
  kind: 'word',
  section: '',
  order: i,
  pos: r.pos as PcicItem['pos'],
  exampleEs: r.sentence.es,
  exampleEn: r.sentence.en,
  exampleHu: r.sentence.hu,
  exampleDe: r.sentence.de,
}));
const byDe = (de: string): PcicItem => {
  const found = ITEMS.find((i) => i.de === de);
  if (!found) throw new Error(`no card for ${de}`);
  return found;
};
const findItem = (id: string) => ITEMS.find((i) => i.id === id);

const learned = (itemId: string, due: string): Sm2Card => ({
  ...sm2NewCard(itemId),
  state: 'review',
  interval: 4,
  reps: 2,
  due,
  lastReview: '2000-01-01',
  introducedAt: '2000-01-01',
});
// every card learned and due, the first ones the longest overdue
const CARDS: Sm2Card[] = ITEMS.map((it, n) => learned(it.id, `2026-10-${String(n + 1).padStart(2, '0')}`));

const seeded = (seed: number) => {
  let x = seed;
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
};

describe.each(PAIRS)('$source -> $target', ({ source, target }) => {
  beforeAll(() => setPcicTarget(target as PcicTarget, source));

  it('the active source is the learner\'s language', () => {
    expect(activeSourceFor(target)).toBe(source);
  });

  it('dictation: the word is the learned language\'s, the meaning the learner\'s, what is read aloud has no bracketed gloss and no alternative', () => {
    for (const item of ITEMS) {
      const w = dictationWord(item, target as PcicTarget);
      expect(w.answer).toBe(item[target]);
      expect(w.meaning).toBe(item[source]);
      expect(w.say).toBe(firstForm(item[target]!, target));
      if (target === 'de') expect(w.say).not.toMatch(/[()/]/);
    }
    if (target === 'de') {
      expect(dictationWord(byDe('die Leute (Pl.)'), 'de').say).toBe('die Leute');
      expect(dictationWord(byDe('kalt (Temperatur)'), 'de').say).toBe('kalt');
      expect(dictationWord(byDe('schließen / zumachen'), 'de').say).toBe('schließen');
    }
  });

  it('dictation: the word as it is written is right, a wrong letter is not; German accepts ss / ae / ue unless accents are strict', () => {
    for (const item of ITEMS) {
      const { answer, say } = dictationWord(item, target as PcicTarget);
      expect(isDictationRight(say, answer, false, target as PcicTarget)).toBe(true);
      expect(isDictationRight(`${say}x`, answer, false, target as PcicTarget)).toBe(false);
      expect(isDictationRight('', answer, false, target as PcicTarget)).toBe(false);
    }
    const strasse = byDe('die Straße');
    const maedchen = byDe('das Mädchen');
    expect(isDictationRight('die Strasse', wordIn(strasse, 'de')!, false, 'de')).toBe(true);
    expect(isDictationRight('das Maedchen', wordIn(maedchen, 'de')!, false, 'de')).toBe(true);
    expect(isDictationRight('die strasse', 'die Straße', true, 'de')).toBe(false);
    expect(isDictationRight('die Straße', 'die Straße', true, 'de')).toBe(true);
    // the gloss is optional, the capital of a noun is not graded
    expect(isDictationRight('die leute', wordIn(byDe('die Leute (Pl.)'), 'de')!, false, 'de')).toBe(true);
    // without the German reading (another learned language) ss is not ß
    expect(isDictationRight('die Strasse', 'die Straße', false, 'es')).toBe(false);
  });

  it('scramble: article fixed, the rest in single-letter tiles (ä and ß are one tile each), a German noun keeps its capital', () => {
    for (const item of ITEMS) {
      const w = scrambleWord(item, target as PcicTarget);
      const written = firstForm(item[target]!, target).normalize('NFC');
      expect(w.say).toBe(written);
      expect(`${w.article ? `${w.article} ` : ''}${w.chars.map((c) => c.ch).join('')}`).toBe(written);
      expect(w.letters).toEqual(w.chars.filter((c) => c.slot !== null).map((c) => c.ch));
      expect(w.meaning).toBe(item[source]);
      if (target === 'de' && /^(der|die|das) /.test(written)) {
        expect(['der', 'die', 'das']).toContain(w.article);
        expect(w.letters[0]).toBe(w.letters[0].toUpperCase());
      } else if (target === 'de') {
        expect(w.article).toBe('');
      }
      if (isScrambleUsable(item, target as PcicTarget)) {
        const tiles = scrambleTiles(w.letters, seedOf(item.id));
        expect([...tiles].sort()).toEqual([...w.letters].sort());
        expect(tiles).not.toEqual(w.letters);
      }
    }
    if (target === 'de') {
      const maedchen = scrambleWord(byDe('das Mädchen'), 'de');
      expect(maedchen).toMatchObject({ article: 'das', letters: ['M', 'ä', 'd', 'c', 'h', 'e', 'n'], say: 'das Mädchen' });
      const strasse = scrambleWord(byDe('die Straße'), 'de');
      expect(strasse.letters).toEqual(['S', 't', 'r', 'a', 'ß', 'e']);
      expect(scrambleWord(byDe('die Leute (Pl.)'), 'de')).toMatchObject({ article: 'die', say: 'die Leute' });
      expect(scrambleWord(byDe('schließen / zumachen'), 'de')).toMatchObject({ article: '', say: 'schließen' });
    }
  });

  it('match: the third language (or the learned one) is the left column, the other the right', () => {
    const left: Lang = target === 'hu' || target === 'de' ? target : source === 'hu' || source === 'de' ? source : 'es';
    const right: Lang = target === 'hu' || target === 'de' ? source : source === 'hu' || source === 'de' ? target : 'en';
    for (const item of ITEMS) {
      expect(isMatchUsable(item, target as PcicTarget)).toBe(true);
      const card = matchCard(item, target as PcicTarget);
      expect(card.es).toBe(firstForm(item[left]!, left));
      expect(card.en).toBe(item[right]!.trim());
      if (left === 'de') expect(card.es).not.toMatch(/[()/]/);
    }
    const boards = buildBoards(ITEMS, target as PcicTarget);
    expect(boards.length).toBeGreaterThan(0);
    for (const board of boards) {
      expect(board).toHaveLength(5);
      const { es, en } = boardColumns(board);
      expect([...es].sort()).toEqual([...board].sort());
      expect([...en].sort()).toEqual([...board].sort());
    }
  });

  it('opposites: only the Spanish and the German deck have pairs, a card of this fixture has none', () => {
    const learnedIds = new Set(ITEMS.map((i) => i.id));
    for (const item of ITEMS) expect(isOppositesUsable(item, target as PcicTarget, learnedIds)).toBe(false);
  });

  if (target !== 'es') {
    it('gap-fill: the word as written in the sentence (inflected capital and punctuation kept), the translation in the learner\'s language', () => {
      let tasks = 0;
      for (const item of ITEMS) {
        const task = gapTaskFor(item, target as PcicTarget);
        if (!task) continue;
        tasks++;
        const sentence = exampleIn(item, target)!;
        expect(`${task.before}${task.answer}${task.after}`).toBe(sentence);
        expect(task.translation).toBe(exampleIn(item, source));
        expect(task.meaning).toBe(item[source]);
        expect(task.answer).toMatch(/^[\p{L}]+$/u);
      }
      expect(tasks).toBeGreaterThanOrEqual(15);
    });

    it('reading: five sentences of learned words, the translations and meanings in the learner\'s language', () => {
      const deps = { target: target as PcicTarget, cards: CARDS, findItem, today: TODAY, random: seeded(7) };
      const set = buildReadingSet(deps);
      expect(set).not.toBeNull();
      expect(set!.words).toHaveLength(READING_WORDS);
      const sourceSentences = new Set(ITEMS.map((i) => exampleIn(i, source)));
      const sourceWords = new Set(ITEMS.map((i) => i[source]));
      for (const word of set!.words) {
        const item = findItem(word.itemId)!;
        expect(word.sentence).toBe(exampleIn(item, target));
        expect(word.translation).toBe(exampleIn(item, source));
        expect(word.sentence).toContain(word.answer);
        expect(meaningOf(item, target as PcicTarget)).toBe(item[source]);
      }
      for (const q of set!.resolved) {
        if (q.kind === 'meaning') for (const option of q.options) expect(sourceWords.has(option)).toBe(true);
        else expect(sourceSentences.has(q.statement)).toBe(true);
      }
      if (target === 'de') {
        for (const word of set!.words) expect(word.sentence).toMatch(/^\p{Lu}/u);
        const nouns = set!.words.filter((w) => /^(Auto|Hund|Katze|Tag|Nacht|Mann|Frau|Mädchen|Straße)$/.test(w.answer));
        for (const w of nouns) expect(w.answer).toMatch(/^\p{Lu}/u);
      }
    });
  }
});

describe('the Spanish target reads its gap through the lemma data, the learner may be German', () => {
  beforeAll(() => setPcicTarget('es', 'de'));

  it('German meaning and translation around a Spanish word', () => {
    const item = byDe('groß');
    const info = () => ({ lemma: 'grande', sentenceLemmas: ['el', 'carro', 'ser', 'grande'] });
    expect(gapTaskFor(item, 'es', info)).toEqual({
      itemId: item.id,
      before: 'El carro es ',
      answer: 'grande',
      after: '.',
      translation: 'Das Auto ist groß.',
      meaning: 'groß',
    });
    expect(readingWordFor(item, 'es', info)?.sentence).toBe('El carro es grande.');
    expect(meaningOf(item, 'es')).toBe('groß');
    expect(gapTaskFor(item, 'es')).toBeNull();
  });
});

describe('German (target) in detail', () => {
  beforeAll(() => setPcicTarget('de', 'hu'));

  it('gap-fill finds a noun by its headword without the article, whatever its gender, and keeps the capital as written', () => {
    const cases: [string, string, string, string][] = [
      ['der Hund', 'Der ', 'Hund', ' ist hässlich.'],
      ['die Katze', 'Die ', 'Katze', ' ist klein.'],
      ['das Auto', 'Das ', 'Auto', ' ist groß.'],
      ['das Mädchen', 'Das ', 'Mädchen', ' ist schön.'],
      ['die Straße', 'Die ', 'Straße', ' ist groß.'],
      ['die Leute (Pl.)', 'Die ', 'Leute', ' kommen.'],
      ['hässlich', 'Der Hund ist ', 'hässlich', '.'],
      ['kalt (Temperatur)', 'Die Nacht ist ', 'kalt', '.'],
    ];
    for (const [de, before, answer, after] of cases) {
      expect(gapTaskFor(byDe(de), 'de')).toMatchObject({ before, answer, after });
    }
  });

  it('gap-fill leaves a word out when its base form is not in the sentence (a verb with a modal is in the infinitive)', () => {
    expect(gapTaskFor({ ...byDe('kaufen'), exampleDe: 'Ich kaufe ein Auto.' }, 'de')).toBeNull();
    expect(gapTaskFor(byDe('kaufen'), 'de')).toMatchObject({ before: 'Ich will ein Auto ', answer: 'kaufen', after: '.' });
    // no match for a part of a longer word
    expect(gapTaskFor({ ...byDe('der Tag'), exampleDe: 'Der Tagesplan ist heiß.' }, 'de')).toBeNull();
  });

  it('the known words of a German learner: the articles are free, a noun needs its own card, its plural comes with it', () => {
    const known = knownTokens('de', { learned: learnedEntries(CARDS, 'de', findItem) });
    for (const free of ['der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'und', 'nicht']) expect(known.has(free)).toBe(true);
    for (const token of ['hund', 'katze', 'auto', 'mädchen', 'straße', 'leute', 'schließen', 'zumachen', 'heiß']) expect(known.has(token)).toBe(true);
    // a noun's plural comes from its card (lib/deForms.ts, data/de/plurals.json): Hunde is known with der Hund
    expect(known.has('hunde')).toBe(true);
    expect(known.has('(pl.)')).toBe(false);
  });
});
