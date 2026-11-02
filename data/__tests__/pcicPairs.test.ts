// The word decks of the twelve pairs: es→hu / en→hu read the Hungarian target deck (h<id>), hu→es / hu→en the Spanish /
// English decks with the Hungarian gloss laid over them; es→de / en→de / hu→de read the German target deck (d<id>), de→es /
// de→en / de→hu the Spanish, English and Hungarian decks with the German gloss laid over them. Some tests load the module with
// one-card fake glosses and a one-card German deck to see that a card without text in the learner's language is left out,
// whatever the shipped German files hold.

import type { PcicLevel } from '@/data/pcic';

const PAIRS: [string, 'es' | 'en' | 'hu' | 'de'][] = [
  ['en', 'es'],
  ['es', 'en'],
  ['es', 'hu'],
  ['en', 'hu'],
  ['hu', 'es'],
  ['hu', 'en'],
  ['en', 'de'],
  ['es', 'de'],
  ['hu', 'de'],
  ['de', 'es'],
  ['de', 'en'],
  ['de', 'hu'],
];

// A German deck of one card, and the German gloss of the first card of each of the other decks.
const DE_CARD = {
  id: 100001,
  level: 'A1',
  de: 'der Hund',
  es: 'el perro',
  en: 'the dog',
  hu: 'a kutya',
  sentence_de: 'Der Hund schläft.',
  sentence_es: 'El perro duerme.',
  sentence_en: 'The dog sleeps.',
  sentence_hu: 'A kutya alszik.',
  pos: 'noun',
  src: 'o1',
};

const LEVELS: PcicLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

const MOCKED = [
  '@/data/words-open/gloss-hu/a1.json',
  '@/data/words/en/gloss-hu/a0.json',
  '@/data/words-open/gloss-de/a1.json',
  '@/data/words/en/gloss-de/a0.json',
  '@/data/words/hu/gloss-de/a0.json',
  '@/data/words/de/a1.json',
];

function load(withGloss: boolean): typeof import('@/data/pcic') {
  let mod!: typeof import('@/data/pcic');
  jest.isolateModules(() => {
    if (withGloss) {
      const openA1 = require('@/data/words-open/a1.json');
      const enA0 = require('@/data/words/en/a0.json');
      const huA0 = require('@/data/words/hu/a0.json');
      jest.doMock('@/data/words-open/gloss-hu/a1.json', () => [{ k: openA1[0].order, hu: 'tesztszó', sentence_hu: 'Ez egy teszt.' }]);
      jest.doMock('@/data/words/en/gloss-hu/a0.json', () => [{ k: enA0[0].id, hu: 'tesztszó', sentence_hu: 'Ez egy teszt.' }]);
      jest.doMock('@/data/words-open/gloss-de/a1.json', () => [{ k: openA1[0].order, de: 'das Testwort', sentence_de: 'Das ist ein Test.' }]);
      jest.doMock('@/data/words/en/gloss-de/a0.json', () => [{ k: enA0[0].id, de: 'das Testwort', sentence_de: 'Das ist ein Test.' }]);
      jest.doMock('@/data/words/hu/gloss-de/a0.json', () => [{ k: huA0[0].id, de: 'das Testwort', sentence_de: 'Das ist ein Test.' }]);
      // the real A1 German gloss of the en and hu decks is left out, so the one glossed test card is the whole A1 deck
      jest.doMock('@/data/words/en/gloss-de/a1.json', () => []);
      jest.doMock('@/data/words/hu/gloss-de/a1.json', () => []);
      jest.doMock('@/data/words/de/a1.json', () => [DE_CARD]);
    }
    mod = require('@/data/pcic');
    // an explicit mock outlives the isolated registry: take it away again for the next load
    for (const path of MOCKED) jest.dontMock(path);
  });
  return mod;
}

function allItems(pcic: typeof import('@/data/pcic')) {
  return LEVELS.flatMap((level) => pcic.pcicItemsForLevel(level));
}

describe('the decks of the twelve pairs', () => {
  it('every card of every pair has a non-empty prompt (source side) and answer (target side)', () => {
    const pcic = load(true);
    for (const [source, target] of PAIRS) {
      pcic.setPcicTarget(target, source);
      const items = allItems(pcic);
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) {
        expect((item as unknown as Record<string, string>)[source]?.trim()).toBeTruthy();
        expect((item as unknown as Record<string, string>)[target]?.trim()).toBeTruthy();
      }
    }
  });

  it('the card ids tell the decks apart: o<order> es, e<id> en, h<id> hu, d<id> de', () => {
    const pcic = load(true);
    for (const [source, target] of PAIRS) {
      pcic.setPcicTarget(target, source);
      const prefix = { es: 'o', en: 'e', hu: 'h', de: 'd' }[target];
      expect(allItems(pcic).every((i) => i.id.startsWith(prefix))).toBe(true);
    }
  });

  it('the Hungarian target has all five levels, es→hu and en→hu offer every one of them', () => {
    const pcic = load(false);
    for (const source of ['es', 'en']) {
      pcic.setPcicTarget('hu', source);
      expect(LEVELS.map((level) => pcic.pcicItemsForLevel(level).length)).toEqual([1203, 1255, 1694, 601, 210]);
      // the "0 items = not offered" filter of the level pickers (onboarding, LevelPickerSheet, stats)
      expect(pcic.PCIC_VIEW_LEVELS.filter((level) => pcic.pcicItemsForLevel(level).length > 0)).toEqual(LEVELS);
    }
  });

  it('every Hungarian card of A2-C1 has hu, es, en and a Hungarian example sentence, on its own level', () => {
    const pcic = load(false);
    for (const [source, target] of [['es', 'hu'], ['en', 'hu']] as const) {
      pcic.setPcicTarget(target, source);
      for (const level of LEVELS.slice(1)) {
        for (const item of pcic.pcicItemsForLevel(level)) {
          expect(item.hu?.trim()).toBeTruthy();
          expect(item.es?.trim()).toBeTruthy();
          expect(item.en?.trim()).toBeTruthy();
          expect(item.exampleHu?.trim()).toBeTruthy();
          expect(pcic.levelOfItem(item.id)).toBe(level);
        }
      }
    }
  });

  it('a Hungarian headword is in the A0-A1 + A2-C1 files once only (no duplicate across the new levels)', () => {
    const headword = (hu: string) =>
      hu.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim().toLowerCase().replace(/^(a|az|egy)\s+/, '');
    const seen = new Set<string>();
    // A0 + A1 are registered first (the duplicates already inside A0/A1 are not this test's business)
    for (const file of ['a0', 'a1']) {
      for (const card of require(`@/data/words/hu/${file}.json`) as { hu: string }[]) seen.add(headword(card.hu));
    }
    const ids = new Set<number>();
    for (const file of ['a2', 'b1', 'b2', 'c1']) {
      for (const card of require(`@/data/words/hu/${file}.json`) as { id: number; hu: string; level: string }[]) {
        expect(card.level).toBe(file.toUpperCase());
        expect(ids.has(card.id)).toBe(false);
        ids.add(card.id);
        const key = headword(card.hu);
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
  });

  it('every Spanish and English card has a Hungarian gloss: hu→es and hu→en are as full as en→es and es→en', () => {
    const pcic = load(false);
    for (const [other, target] of [['en', 'es'], ['es', 'en']] as const) {
      pcic.setPcicTarget(target, other);
      const full = allItems(pcic).length;
      pcic.setPcicTarget(target, 'hu');
      const hu = allItems(pcic);
      expect(hu).toHaveLength(full);
      for (const item of hu) expect(item.hu?.trim()).toBeTruthy();
    }
  });

  it('a card without Hungarian text is left out of hu→es, the glossed one keeps its Hungarian example', () => {
    const pcic = load(true);
    pcic.setPcicTarget('es', 'hu');
    const a1 = pcic.pcicItemsForLevel('A1');
    expect(a1).toHaveLength(1);
    expect(a1[0]).toMatchObject({ hu: 'tesztszó', exampleHu: 'Ez egy teszt.' });
  });

  it('a Hungarian or German prompt gets no hint sentence, the hint is written in English (en→es) or Spanish (es→en)', () => {
    const pcic = load(true);
    pcic.setPcicTarget('es', 'en');
    expect(allItems(pcic).some((i) => i.hint)).toBe(true);
    pcic.setPcicTarget('en', 'es');
    expect(allItems(pcic).some((i) => i.hint)).toBe(true);
    for (const target of ['es', 'en'] as const) {
      for (const source of ['hu', 'de']) {
        pcic.setPcicTarget(target, source);
        expect(allItems(pcic).filter((i) => i.hint)).toEqual([]);
      }
    }
  });

  it('hu→de: the German deck card prompts in Hungarian and is answered in German, with the German example sentence', () => {
    const pcic = load(true);
    pcic.setPcicTarget('de', 'hu');
    const a1 = pcic.pcicItemsForLevel('A1');
    expect(a1).toHaveLength(1);
    expect(a1[0]).toMatchObject({
      id: 'd100001',
      hu: 'a kutya',
      de: 'der Hund',
      es: 'el perro',
      en: 'the dog',
      kind: 'word',
      pos: 'noun',
      exampleHu: 'A kutya alszik.',
      exampleDe: 'Der Hund schläft.',
    });
    expect(pcic.levelOfItem('d100001')).toBe('A1');
    expect(pcic.findPcicItem('d100001')).toBe(a1[0]);
    // the other levels of the (mocked) German deck are empty
    expect(pcic.pcicItemsForLevel('A2')).toEqual([]);
  });

  it('es→de and en→de read the same German deck, prompted in their own language', () => {
    const pcic = load(true);
    pcic.setPcicTarget('de', 'es');
    expect(pcic.pcicItemsForLevel('A1').map((i) => [i.es, i.de])).toEqual([['el perro', 'der Hund']]);
    pcic.setPcicTarget('de', 'en');
    expect(pcic.pcicItemsForLevel('A1').map((i) => [i.en, i.de])).toEqual([['the dog', 'der Hund']]);
  });

  it('de→es, de→en and de→hu run on the German gloss of the Spanish, English and Hungarian decks', () => {
    const pcic = load(true);
    for (const target of ['es', 'en', 'hu'] as const) {
      pcic.setPcicTarget(target, 'de');
      const a1 = pcic.pcicItemsForLevel('A1');
      // only the glossed card has German text: every other card is left out, never shown with an empty prompt
      expect(a1).toHaveLength(1);
      expect(a1[0]).toMatchObject({ de: 'das Testwort', exampleDe: 'Das ist ein Test.' });
      expect(a1[0][target]?.trim()).toBeTruthy();
    }
  });

  it('without any German gloss, de→es, de→en and de→hu offer no card at all (an empty state, never another language)', () => {
    const glossPaths = [
      ...['a1', 'a2', 'b1', 'b2', 'c1'].map((l) => `@/data/words-open/gloss-de/${l}.json`),
      ...['en', 'hu'].flatMap((deck) => ['a0', 'a1', 'a2', 'b1', 'b2', 'c1'].map((l) => `@/data/words/${deck}/gloss-de/${l}.json`)),
    ];
    let pcic!: typeof import('@/data/pcic');
    jest.isolateModules(() => {
      for (const path of glossPaths) jest.doMock(path, () => []);
      pcic = require('@/data/pcic');
      for (const path of glossPaths) jest.dontMock(path);
    });
    for (const target of ['es', 'en', 'hu'] as const) {
      pcic.setPcicTarget(target, 'de');
      expect(allItems(pcic)).toEqual([]);
    }
  });

  it('kindOfDe: a word or noun phrase is a word, several words a phrase', () => {
    const pcic = load(false);
    for (const word of ['der Hund', 'das Auto', 'gehen', 'sich freuen', 'die Leute (Pl.)', 'sein (Zustand, Ort)', 'der Ort / der Platz', 'ein Haus']) {
      expect(pcic.kindOfDe(word)).toBe('word');
    }
    for (const phrase of ['guten Morgen', 'Wie geht es dir?', 'der Ort / das große Haus']) {
      expect(pcic.kindOfDe(phrase)).toBe('phrase');
    }
  });

  it('en→es and es→en are the full decks, with no card left out', () => {
    const pcic = load(false);
    pcic.setPcicTarget('es', 'en');
    expect(pcic.pcicItemsForLevel('A1').length).toBeGreaterThan(100);
    pcic.setPcicTarget('en', 'es');
    expect(pcic.pcicItemsForLevel('A1').length).toBeGreaterThan(100);
  });
});