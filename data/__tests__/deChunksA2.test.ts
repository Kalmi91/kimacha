// The German build-up steps of the A2 sentences (data/sentences/chunks-de-a2.json): every step is a shorter sentence made of its
// sentence's own words, passes the German sentence check at A2 with the A1 and A2 words learned, and has its prompt in all three
// languages. The A1 steps are checked in deSentences.test.ts.

import chunkData from '@/data/sentences/chunks-de-a2.json';
import deA1 from '@/data/words/de/a1.json';
import deA2 from '@/data/words/de/a2.json';
import { deStructuresAbove } from '@/lib/grammar/deTenseGate';
import { knownTokens, unknownTokensIn } from '@/lib/knownSentence';
import { setActiveSource } from '@/lib/languagePair';
import { chunksFor, partFitsSentence } from '@/lib/sentenceChunks';
import { tileWords } from '@/lib/sentenceCards';

type Card = { id: number; de: string; pos: string; sentence_de: string };
const A2_CARDS = new Map((deA2 as Card[]).map((c) => [`d${c.id}`, c]));
const EM_DASH = String.fromCharCode(0x2014);
const steps = chunkData as Record<string, Array<{ de: string; en: string; es: string; hu: string }>>;

describe('chunks-de-a2.json', () => {
  it('is keyed by ids of the A2 German deck and every step fits its sentence and grows', () => {
    const problems: string[] = [];
    for (const [id, parts] of Object.entries(steps)) {
      const card = A2_CARDS.get(id);
      if (!card) {
        problems.push(`${id}: not an A2 card`);
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

  it('every step passes the German sentence check at A2 with the A1 and A2 words learned', () => {
    const learned = [...(deA1 as Card[]), ...(deA2 as Card[])].map((c) => ({ text: c.de, pos: c.pos }));
    const known = knownTokens('de', { learned, level: 'A2' });
    const problems: string[] = [];
    for (const [id, parts] of Object.entries(steps)) {
      for (const part of parts) {
        const unknown = unknownTokensIn(part.de, 'de', known);
        if (unknown.length > 0) problems.push(`${id}: "${part.de}" has unknown words ${unknown.join(', ')}`);
        const above = deStructuresAbove(part.de, 'A2');
        if (above.length > 0) problems.push(`${id}: "${part.de}" uses ${above.join(', ')}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('every step has its prompt in all three languages, no em dash, and ends like a sentence', () => {
    const problems: string[] = [];
    for (const [id, parts] of Object.entries(steps)) {
      for (const part of parts) {
        for (const key of ['de', 'en', 'es', 'hu'] as const) {
          if (!part[key]?.trim()) problems.push(`${id}: empty ${key}`);
          if (part[key]?.includes(EM_DASH)) problems.push(`${id}: em dash in ${key}`);
          if (part[key] && !/[.?!]$/.test(part[key])) problems.push(`${id}: ${key} "${part[key]}" has no final punctuation`);
        }
      }
    }
    expect(problems).toEqual([]);
    expect(Object.keys(steps).length).toBeGreaterThanOrEqual(1150);
  });
});

describe('the Sentences tab reads the A2 steps', () => {
  afterEach(() => setActiveSource(null));

  it('gives every language its own prompt for the steps of an A2 sentence', () => {
    const id = 'd100151';
    const card = A2_CARDS.get(id);
    expect(card).toBeDefined();
    for (const source of ['en', 'es', 'hu'] as const) {
      setActiveSource(source);
      const chunks = chunksFor(id, 'de', card!.sentence_de);
      expect(chunks?.map((c) => c.target)).toEqual(steps[id].map((s) => s.de));
      expect(chunks?.map((c) => c.source)).toEqual(steps[id].map((s) => s[source]));
    }
  });
});
