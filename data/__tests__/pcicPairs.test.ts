// The word decks of the six pairs: es→hu / en→hu read the Hungarian target deck (h<id>), hu→es / hu→en the Spanish /
// English decks with the Hungarian gloss laid over them. Some tests load the module with a one-card fake gloss to
// see that a card without Hungarian text is left out.

import type { PcicLevel } from '@/data/pcic';

const PAIRS: [string, 'es' | 'en' | 'hu'][] = [
  ['en', 'es'],
  ['es', 'en'],
  ['es', 'hu'],
  ['en', 'hu'],
  ['hu', 'es'],
  ['hu', 'en'],
];

const LEVELS: PcicLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

function load(withGloss: boolean): typeof import('@/data/pcic') {
  let mod!: typeof import('@/data/pcic');
  jest.isolateModules(() => {
    if (withGloss) {
      const openA1 = require('@/data/words-open/a1.json');
      const enA0 = require('@/data/words/en/a0.json');
      jest.doMock('@/data/words-open/gloss-hu/a1.json', () => [{ k: openA1[0].order, hu: 'tesztszó', sentence_hu: 'Ez egy teszt.' }]);
      jest.doMock('@/data/words/en/gloss-hu/a0.json', () => [{ k: enA0[0].id, hu: 'tesztszó', sentence_hu: 'Ez egy teszt.' }]);
    }
    mod = require('@/data/pcic');
    // an explicit mock outlives the isolated registry: take it away again for the next load
    jest.dontMock('@/data/words-open/gloss-hu/a1.json');
    jest.dontMock('@/data/words/en/gloss-hu/a0.json');
  });
  return mod;
}

function allItems(pcic: typeof import('@/data/pcic')) {
  return LEVELS.flatMap((level) => pcic.pcicItemsForLevel(level));
}

describe('the decks of the six pairs', () => {
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

  it('the card ids tell the decks apart: o<order> es, e<id> en, h<id> hu', () => {
    const pcic = load(true);
    for (const [source, target] of PAIRS) {
      pcic.setPcicTarget(target, source);
      const prefix = { es: 'o', en: 'e', hu: 'h' }[target];
      expect(allItems(pcic).every((i) => i.id.startsWith(prefix))).toBe(true);
    }
  });

  it('the Hungarian target has A1 only, no empty level to offer', () => {
    const pcic = load(false);
    pcic.setPcicTarget('hu', 'es');
    expect(pcic.pcicItemsForLevel('A1').length).toBe(1203);
    for (const level of LEVELS.slice(1)) expect(pcic.pcicItemsForLevel(level)).toEqual([]);
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

  it('a Hungarian prompt gets no hint sentence, the hint is written in English (en→es) or Spanish (es→en)', () => {
    const pcic = load(false);
    pcic.setPcicTarget('es', 'en');
    expect(allItems(pcic).some((i) => i.hint)).toBe(true);
    for (const target of ['es', 'en'] as const) {
      pcic.setPcicTarget(target, 'hu');
      expect(allItems(pcic).filter((i) => i.hint)).toEqual([]);
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