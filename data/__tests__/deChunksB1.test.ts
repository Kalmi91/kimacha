// The German build-up steps of the B1 sentences (data/sentences/chunks-de-b1.json): keyed by ids of the B1 part of the German deck,
// every step is a whole, shorter sentence made of the sentence's own words, the steps grow, every language has a prompt, and the
// German sentence check accepts every step at B1 with the words of A1 to B1 learned (no unknown word, no tense above B1).

import chunkData from '@/data/sentences/chunks-de-b1.json';
import deA1 from '@/data/words/de/a1.json';
import deA2 from '@/data/words/de/a2.json';
import deB1 from '@/data/words/de/b1.json';
import { deStructuresAbove } from '@/lib/grammar/deTenseGate';
import { knownTokens, unknownTokensIn } from '@/lib/knownSentence';
import { partFitsSentence } from '@/lib/sentenceChunks';
import { tileWords } from '@/lib/sentenceCards';

type Card = { id: number; de: string; pos: string; sentence_de: string };
type Step = { de: string; en: string; es: string; hu: string };

const B1 = new Map((deB1 as Card[]).map((c) => [`d${c.id}`, c]));
const EM_DASH = String.fromCharCode(0x2014);
const steps = chunkData as Record<string, Step[]>;

describe('chunks-de-b1.json', () => {
  it('is keyed by ids of the B1 German deck, 2 or 3 steps at most, every step fits its sentence and the steps grow', () => {
    const problems: string[] = [];
    for (const [id, parts] of Object.entries(steps)) {
      const card = B1.get(id);
      if (!card) {
        problems.push(`${id}: not a B1 card`);
        continue;
      }
      if (parts.length === 0 || parts.length > 3) problems.push(`${id}: ${parts.length} steps`);
      for (const part of parts) {
        if (!partFitsSentence(part.de, card.sentence_de)) problems.push(`${id}: "${part.de}" does not fit "${card.sentence_de}"`);
      }
      const sizes = parts.map((p) => tileWords(p.de).length);
      if (sizes.some((n, i) => i > 0 && n <= sizes[i - 1])) problems.push(`${id}: the steps do not grow`);
    }
    expect(problems).toEqual([]);
    expect(Object.keys(steps).length).toBeGreaterThanOrEqual(1250);
  });

  it('every step has its prompt in all four languages, ends like a sentence and has no em dash', () => {
    const problems: string[] = [];
    for (const [id, parts] of Object.entries(steps)) {
      for (const part of parts) {
        for (const key of ['de', 'en', 'es', 'hu'] as const) {
          const text = part[key];
          if (!text?.trim()) problems.push(`${id}: empty ${key}`);
          else if (text.includes(EM_DASH) || !/[.!?]$/.test(text)) problems.push(`${id}: ${key} "${text}"`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('the German sentence check accepts every step at B1 with the words of A1 to B1 learned', () => {
    const learned = [...(deA1 as Card[]), ...(deA2 as Card[]), ...(deB1 as Card[])].map((c) => ({ text: c.de, pos: c.pos }));
    const known = knownTokens('de', { learned, level: 'B1' });
    const problems: string[] = [];
    for (const [id, parts] of Object.entries(steps)) {
      for (const part of parts) {
        const unknown = unknownTokensIn(part.de, 'de', known);
        const above = deStructuresAbove(part.de, 'B1');
        if (unknown.length > 0 || above.length > 0) problems.push(`${id}: "${part.de}" ${unknown.join(',')} ${above.join(',')}`);
      }
    }
    expect(problems).toEqual([]);
  });
});
