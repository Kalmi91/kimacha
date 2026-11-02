// Opposites in German (target de): the pairs of data/practice/opposites-de.json against a small German deck, so the test does not depend
// on how far the generated deck (data/words/de) is (test-utils/germanDeck.ts). The deck has gender-marked nouns, a bracketed gloss
// (kalt (Temperatur)) and an alternative (schließen / zumachen) to check that a pair finds its cards through both.

jest.mock('@/data/words/de/a1.json', () => require('@/test-utils/germanDeck').germanDeckA1());

import pairs from '@/data/practice/opposites-de.json';
import { GERMAN_DECK_ROWS } from '@/test-utils/germanDeck';
import { findPcicItem, pcicItemsForLevel, setPcicTarget, type PcicItem } from '@/data/pcic';
import {
  OPPOSITES_OPTIONS,
  buildQuestion,
  isOppositesUsable,
  nextOpposites,
  oppositeText,
  oppositesDone,
  oppositesOf,
  oppositesScore,
  parseOpposites,
  pickOption,
  startOpposites,
} from '../opposites';

setPcicTarget('de', 'hu');
const DECK: PcicItem[] = pcicItemsForLevel('A1');
const card = (de: string): PcicItem => {
  const found = DECK.find((i) => i.de === de);
  if (!found) throw new Error(`no card for ${de}`);
  return found;
};
const id = (de: string) => card(de).id;
const everything = new Set(DECK.map((i) => i.id));

describe('the German pairs find their cards', () => {
  it('the deck is the German one: ids d<id>, the opposites are looked up in both directions', () => {
    expect(DECK).toHaveLength(GERMAN_DECK_ROWS.length);
    expect(id('groß')).toBe('d200001');
    expect(oppositesOf(id('groß'))).toEqual([id('klein')]);
    expect(oppositesOf(id('klein'))).toEqual([id('groß')]);
    expect(oppositesOf(id('der Tag'))).toEqual([id('die Nacht')]);
    expect(oppositesOf(id('die Frau'))).toEqual([id('der Mann')]);
  });

  it('a bracketed gloss and an alternative do not stop a card from being found', () => {
    expect(oppositesOf(id('heiß'))).toEqual([id('kalt (Temperatur)')]);
    expect(oppositesOf(id('kalt (Temperatur)'))).toEqual([id('heiß')]);
    expect(oppositesOf(id('öffnen'))).toEqual([id('schließen / zumachen')]);
    expect(oppositesOf(id('schließen / zumachen'))).toEqual([id('öffnen')]);
  });

  it('a word with no pair has none; a word of the pair data that is not in the deck links nothing', () => {
    expect(oppositesOf(id('der Hund'))).toEqual([]);
    expect(oppositesOf(id('die Katze'))).toEqual([]);
    expect(oppositesOf('d999999')).toEqual([]);
    // gehen is in two pairs of the data (kommen, bleiben): only kommen is in this deck
    expect(oppositesOf(id('gehen'))).toEqual([id('kommen')]);
  });

  it('the Spanish pairs are untouched by the German ones', () => {
    for (const key of ['o1', 'o2', 'o3']) for (const other of oppositesOf(key)) expect(other.startsWith('o')).toBe(true);
  });
});

describe('what a card shows', () => {
  it('the word with its article, the first alternative, no bracketed gloss', () => {
    expect(oppositeText(card('der Tag'), 'de')).toBe('der Tag');
    expect(oppositeText(card('das Auto'), 'de')).toBe('das Auto');
    expect(oppositeText(card('kalt (Temperatur)'), 'de')).toBe('kalt');
    expect(oppositeText(card('schließen / zumachen'), 'de')).toBe('schließen');
    expect(oppositeText(card('hässlich'), 'de')).toBe('hässlich');
  });
});

describe('buildQuestion in German', () => {
  it('an adjective: the opposite and three other learned adjectives, none the word, all with different texts', () => {
    const q = buildQuestion(card('groß'), everything, 'de')!;
    expect(q.options).toHaveLength(OPPOSITES_OPTIONS);
    expect(q.answer).toBe(id('klein'));
    expect(q.options).toContain(q.answer);
    expect(q.options).not.toContain(id('groß'));
    for (const o of q.options) expect(findPcicItem(o)!.pos).toBe('adj');
    expect(new Set(q.options.map((o) => oppositeText(findPcicItem(o)!, 'de'))).size).toBe(OPPOSITES_OPTIONS);
  });

  it('a noun: the options are nouns, each with its article', () => {
    const q = buildQuestion(card('der Tag'), everything, 'de')!;
    expect(q.answer).toBe(id('die Nacht'));
    const shown = q.options.map((o) => oppositeText(findPcicItem(o)!, 'de'));
    for (const text of shown) expect(text).toMatch(/^(der|die|das) \p{Lu}/u);
    expect(shown).toContain('die Nacht');
  });

  it('a verb with an alternative headword: the option shows the first alternative only', () => {
    const q = buildQuestion(card('öffnen'), everything, 'de')!;
    expect(q.answer).toBe(id('schließen / zumachen'));
    expect(q.options.map((o) => oppositeText(findPcicItem(o)!, 'de'))).toContain('schließen');
    expect(q.options.map((o) => oppositeText(findPcicItem(o)!, 'de'))).not.toContain('schließen / zumachen');
  });

  it('is the same question every time; the same unrelated words never include the other opposite', () => {
    expect(buildQuestion(card('schön'), everything, 'de')).toEqual(buildQuestion(card('schön'), everything, 'de'));
    const q = buildQuestion(card('heiß'), everything, 'de')!;
    expect(q.options.filter((o) => oppositesOf(id('heiß')).includes(o))).toEqual([q.answer]);
  });

  it('no question without the opposite learned, or with fewer than three other learned words of the same kind', () => {
    const without = new Set(everything);
    without.delete(id('klein'));
    expect(buildQuestion(card('groß'), without, 'de')).toBeNull();
    const few = new Set([id('groß'), id('klein'), id('heiß'), id('kalt (Temperatur)')]);
    expect(buildQuestion(card('groß'), few, 'de')).toBeNull();
    expect(buildQuestion(card('der Hund'), everything, 'de')).toBeNull();
  });

  it('isOppositesUsable: the paired, learnable words of a German round', () => {
    expect(isOppositesUsable(card('groß'), 'de', everything)).toBe(true);
    expect(isOppositesUsable(card('der Hund'), 'de', everything)).toBe(false);
    expect(isOppositesUsable(card('groß'), 'de', new Set())).toBe(false);
  });
});

describe('the learner may speak any language: the German question does not change', () => {
  it.each(['en', 'es', 'hu'] as const)('source %s: same cards, same options, same words on the screen', (source) => {
    setPcicTarget('de', source);
    const deck = pcicItemsForLevel('A1');
    expect(deck.map((i) => i.id)).toEqual(DECK.map((i) => i.id));
    const q = buildQuestion(deck.find((i) => i.de === 'groß')!, everything, 'de')!;
    expect(q).toEqual(buildQuestion(card('groß'), everything, 'de'));
    expect(oppositeText(findPcicItem(q.answer)!, 'de')).toBe('klein');
    setPcicTarget('de', 'hu');
  });
});

describe('a German round', () => {
  const words = ['groß', 'der Tag', 'öffnen', 'kommen'].map(card);
  const start = () => startOpposites(words.map((w) => w.id), { items: words, learned: everything, target: 'de' });

  it('plays through: a right tap scores, a wrong one shows the answer, the round ends after the last word', () => {
    let st = start();
    expect(st.queue).toEqual(words.map((w) => w.id));
    for (const [n, w] of words.entries()) {
      const q = st.questions[w.id];
      const wrong = q.options.find((o) => o !== q.answer)!;
      const tapped = pickOption(st, n % 2 === 0 ? q.answer : wrong);
      expect(tapped.hit).toBe(n % 2 === 0);
      st = nextOpposites(tapped.state);
    }
    expect(oppositesDone(st)).toBe(true);
    expect(oppositesScore(st)).toBe(2);
  });

  it('saves and resumes: a state with German ids comes back, a foreign option does not', () => {
    const st = pickOption(start(), start().questions[words[0].id].answer).state;
    const saved = JSON.parse(JSON.stringify(st));
    expect(parseOpposites(saved, words.map((w) => w.id))).toEqual(st);
    const broken = JSON.parse(JSON.stringify(st));
    broken.questions[words[0].id].options[0] = 'o1';
    expect(parseOpposites(broken, words.map((w) => w.id))).toBeNull();
  });
});

describe('data/practice/opposites-de.json', () => {
  const list = pairs as { a: string; b: string }[];
  const members = list.flatMap((p) => [p.a, p.b]);

  it('about 160 pairs of two different words, nothing else in a pair', () => {
    expect(list.length).toBeGreaterThanOrEqual(150);
    expect(list.length).toBeLessThanOrEqual(175);
    for (const p of list) {
      expect(Object.keys(p).sort()).toEqual(['a', 'b']);
      expect(p.a).not.toBe(p.b);
    }
  });

  it('a noun is der / die / das + a capitalised noun, every other word is lower case without an article', () => {
    for (const w of members) {
      expect(w).toBe(w.trim());
      expect(/^(der|die|das) \p{Lu}\p{Ll}+$/u.test(w) || /^[\p{Ll}ßäöü]+( [\p{Ll}ßäöü]+)?$/u.test(w)).toBe(true);
    }
    expect(members.filter((w) => /^(der|die|das) /.test(w)).length).toBeGreaterThan(20);
    // all three genders and the umlauts are there
    for (const article of ['der', 'die', 'das']) expect(members.some((w) => w.startsWith(`${article} `))).toBe(true);
    expect(members.some((w) => /[äöü]/.test(w))).toBe(true);
    expect(members.some((w) => w.includes('ß'))).toBe(true);
  });

  it('no pair twice (in either order), a word in at most two pairs, no em dash', () => {
    const keys = list.map((p) => [p.a, p.b].sort().join('|'));
    expect(new Set(keys).size).toBe(keys.length);
    const count = new Map<string, number>();
    for (const w of members) count.set(w, (count.get(w) ?? 0) + 1);
    expect([...count].filter(([, n]) => n > 2)).toEqual([]);
    expect(JSON.stringify(list)).not.toContain(String.fromCharCode(0x2014));
  });
});
