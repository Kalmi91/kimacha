// The German build-up steps of the B2 and C1 sentences (data/sentences/chunks-de-b2c1.json): every step is a shorter sentence made of
// its sentence's own words, still passes the learned-words gate and the tense gate at the sentence's level, and has its prompt in all
// three languages a German learner can come from.

import chunkData from '@/data/sentences/chunks-de-b2c1.json';
import chunkDataA1 from '@/data/sentences/chunks-de.json';
import deA1 from '@/data/words/de/a1.json';
import deA2 from '@/data/words/de/a2.json';
import deB1 from '@/data/words/de/b1.json';
import deB2 from '@/data/words/de/b2.json';
import deC1 from '@/data/words/de/c1.json';
import type { DeLevel } from '@/lib/deForms';
import { deStructuresAbove } from '@/lib/grammar/deTenseGate';
import { knownTokens, unknownTokensIn } from '@/lib/knownSentence';
import { tileWords } from '@/lib/sentenceCards';
import { partFitsSentence } from '@/lib/sentenceChunks';

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
const steps = chunkData as Record<string, Array<{ de: string; en: string; es: string; hu: string }>>;

describe('chunks-de-b2c1.json', () => {
  it('is keyed by B2 and C1 ids of the German deck, apart from the A1 file, and every step fits its sentence and grows', () => {
    const problems: string[] = [];
    for (const [id, parts] of Object.entries(steps)) {
      const card = DECK.get(id);
      if (!card || (card.level !== 'B2' && card.level !== 'C1')) {
        problems.push(`${id}: not a B2 or C1 card of the deck`);
        continue;
      }
      if (id in chunkDataA1) problems.push(`${id}: also in chunks-de.json`);
      if (parts.length === 0) problems.push(`${id}: no steps`);
      for (const part of parts) {
        if (!partFitsSentence(part.de, card.sentence_de)) problems.push(`${id}: "${part.de}" does not fit "${card.sentence_de}"`);
      }
      const sizes = parts.map((p) => tileWords(p.de).length);
      if (sizes.some((n, i) => i > 0 && n <= sizes[i - 1])) problems.push(`${id}: the steps do not grow`);
    }
    expect(problems).toEqual([]);
    expect(Object.keys(steps).length).toBeGreaterThanOrEqual(400);
  });

  it('every step has its prompt in all three languages, no em dash, and no two steps share a prompt', () => {
    const problems: string[] = [];
    for (const [id, parts] of Object.entries(steps)) {
      for (const part of parts) {
        for (const key of ['de', 'en', 'es', 'hu'] as const) {
          if (!part[key]?.trim()) problems.push(`${id}: empty ${key}`);
          if (part[key]?.includes(EM_DASH)) problems.push(`${id}: em dash in ${key}`);
        }
      }
      for (const key of ['en', 'es', 'hu'] as const) {
        if (new Set(parts.map((p) => p[key])).size !== parts.length) problems.push(`${id}: two steps share the ${key} prompt`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('every step passes the learned-words gate and the tense gate at the level of its sentence', () => {
    const problems: string[] = [];
    let learnedSoFar: Card[] = [];
    for (const [level, cards] of LEVELS) {
      learnedSoFar = learnedSoFar.concat(cards);
      if (level !== 'B2' && level !== 'C1') continue;
      const known = knownTokens('de', { learned: learnedSoFar.map((c) => ({ text: c.de, pos: c.pos })), level });
      for (const card of cards) {
        for (const part of steps[`d${card.id}`] ?? []) {
          const unknown = unknownTokensIn(part.de, 'de', known);
          const above = deStructuresAbove(part.de, level);
          if (unknown.length > 0 || above.length > 0) problems.push(`d${card.id}: "${part.de}" ${unknown.join(',')} ${above.join(',')}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });
});
