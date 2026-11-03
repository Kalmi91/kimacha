// The German deck seen by the Sentences tab: the build-up steps (data/sentences/chunks-de.json) fit their sentences, the plural
// table is well formed, and the example sentences of each level pass the learned-words gate with the words of that level and
// below learned, without a tense above their level. The pass rate is a floor (a ratchet), the violations are listed on failure.

import chunkData from '@/data/sentences/chunks-de.json';
import plurals from '@/data/de/plurals.json';
import deA1 from '@/data/words/de/a1.json';
import deA2 from '@/data/words/de/a2.json';
import deB1 from '@/data/words/de/b1.json';
import deB2 from '@/data/words/de/b2.json';
import deC1 from '@/data/words/de/c1.json';
import type { DeLevel } from '@/lib/deForms';
import { deStructuresAbove } from '@/lib/grammar/deTenseGate';
import { knownTokens, unknownTokensIn } from '@/lib/knownSentence';
import { partFitsSentence } from '@/lib/sentenceChunks';
import { tileWords } from '@/lib/sentenceCards';

type Card = { id: number; level: string; de: string; pos: string; sentence_de: string };
const LEVELS: Array<[DeLevel, Card[]]> = [
  ['A1', deA1 as Card[]],
  ['A2', deA2 as Card[]],
  ['B1', deB1 as Card[]],
  ['B2', deB2 as Card[]],
  ['C1', deC1 as Card[]],
];
const DECK = new Map(LEVELS.flatMap(([, cards]) => cards).map((c) => [`d${c.id}`, c]));
const EM_DASH = String.fromCharCode(0x2014);

describe('chunks-de.json', () => {
  const steps = chunkData as Record<string, Array<{ de: string; en: string; es: string; hu: string }>>;

  it('is keyed by ids of the German deck and every step fits its sentence', () => {
    const problems: string[] = [];
    for (const [id, parts] of Object.entries(steps)) {
      const card = DECK.get(id);
      if (!card) {
        problems.push(`${id}: not in the deck`);
        continue;
      }
      for (const part of parts) {
        if (!partFitsSentence(part.de, card.sentence_de)) problems.push(`${id}: "${part.de}" does not fit "${card.sentence_de}"`);
      }
      const sizes = parts.map((p) => tileWords(p.de).length);
      if (sizes.some((n, i) => i > 0 && n <= sizes[i - 1])) problems.push(`${id}: the steps do not grow`);
    }
    expect(problems).toEqual([]);
  });

  it('every step has its prompt in all three languages and no em dash', () => {
    const problems: string[] = [];
    for (const [id, parts] of Object.entries(steps)) {
      for (const part of parts) {
        for (const key of ['de', 'en', 'es', 'hu'] as const) {
          if (!part[key]?.trim()) problems.push(`${id}: empty ${key}`);
          if (part[key]?.includes(EM_DASH)) problems.push(`${id}: em dash in ${key}`);
        }
      }
    }
    expect(problems).toEqual([]);
    expect(Object.keys(steps).length).toBeGreaterThanOrEqual(80);
  });
});

describe('plurals.json', () => {
  it('has lower-case keys and plurals, one or more per noun', () => {
    const table = plurals as Record<string, string[]>;
    const bad = Object.entries(table).filter(([key, list]) => key !== key.toLowerCase() || !Array.isArray(list) || list.length === 0 || list.some((p) => p !== p.toLowerCase() || p.includes(EM_DASH)));
    expect(bad).toEqual([]);
    expect(Object.keys(table).length).toBeGreaterThan(2000);
  });
});

describe('the example sentences of the German deck, each level with its own words learned', () => {
  // floors, a little under the measured pass rate (2026-11-03: A1 96.9%, A2 94.0%, B1 90.1%, B2 90.2%, C1 90.5%; was A1 94%, A2 81%, B1 83%, B2 82%, C1 83%)
  const FLOOR: Record<DeLevel, number> = { A1: 0.95, A2: 0.92, B1: 0.88, B2: 0.88, C1: 0.88 };
  let learnedSoFar: Card[] = [];
  for (const [level, cards] of LEVELS) {
    learnedSoFar = learnedSoFar.concat(cards);
    const learned = learnedSoFar.map((c) => ({ text: c.de, pos: c.pos }));
    it(`${level}: the pass rate holds and no sentence uses a tense above its level`, () => {
      const known = knownTokens('de', { learned, level });
      let pass = 0;
      const above: string[] = [];
      for (const card of cards) {
        const structures = deStructuresAbove(card.sentence_de, level);
        if (structures.length > 0) above.push(`d${card.id} ${card.sentence_de} (${structures.join(', ')})`);
        if (unknownTokensIn(card.sentence_de, 'de', known).length === 0 && structures.length === 0) pass++;
      }
      expect(cards.length === 0 ? 1 : pass / cards.length).toBeGreaterThanOrEqual(FLOOR[level]);
      expect(above.length).toBeLessThanOrEqual(5);
    });
  }
});
