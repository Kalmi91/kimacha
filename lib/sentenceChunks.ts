// The shorter sentences a long example sentence is built up from on the Sentences tab (FB524, reworked for FB538): the
// learner builds each one from tiles before building the whole sentence. FB538 ("the sentence is obviously cut up; my
// mother irons, and then my mother irons my clothes"): each step is a whole, shorter sentence that grows towards the
// example ("Mi madre plancha." -> "Mi madre plancha mi camisa."), not a fragment of it. The steps are data
// (data/sentences/chunks.json, keyed by item id), written per sentence; an empty list or no entry = the sentence is
// simply built whole (no natural shorter sentence, or a short one).

import chunkData from '@/data/sentences/chunks.json';
import chunkDataDe from '@/data/sentences/chunks-de.json';
import type { PcicTarget } from '@/data/pcic';
import { activeSourceFor } from '@/lib/languagePair';
import { tileWords } from '@/lib/sentenceCards';

/** One step: `source` is its prompt (English for the Spanish deck, the learner's language for the German one), `target` the sentence to build. */
export interface SentenceChunk {
  source: string;
  target: string;
}

const CHUNKS = chunkData as Record<string, { es: string; en: string }[]>;
// The German deck's steps (data/sentences/chunks-de.json, keyed by the deck item id "d<id>"): the German sentence and its
// prompt in each of the three languages a German learner can come from.
const CHUNKS_DE = chunkDataDe as Record<string, { de: string; en: string; es: string; hu: string }[]>;

const words = (sentence: string): string[] => tileWords(sentence).map((w) => w.toLowerCase());

/**
 * Whether `part` uses only words of `sentence` (each at most as often) and fewer of them: then it brings no word the
 * learner does not know, and it no longer fits once the sentence was rewritten.
 */
export function partFitsSentence(part: string, sentence: string): boolean {
  const left = new Map<string, number>();
  const all = words(sentence);
  for (const w of all) left.set(w, (left.get(w) ?? 0) + 1);
  const own = words(part);
  if (own.length === 0 || own.length >= all.length) return false;
  for (const w of own) {
    const n = left.get(w) ?? 0;
    if (n === 0) return false;
    left.set(w, n - 1);
  }
  return true;
}

/**
 * The shorter sentences of the item's example sentence, or undefined (none written, the English and Hungarian directions, or the data no
 * longer fits the sentence, see partFitsSentence). The Spanish and the German direction.
 */
export function chunksFor(itemId: string, target: PcicTarget, sentence: string): SentenceChunk[] | undefined {
  if (target === 'de') {
    const source = activeSourceFor('de');
    const german = CHUNKS_DE[itemId];
    if (!german || german.length === 0 || source === 'de') return undefined;
    if (!german.every((p) => p[source] && partFitsSentence(p.de, sentence))) return undefined;
    return german.map((p) => ({ source: p[source], target: p.de }));
  }
  if (target !== 'es') return undefined;
  // the Spanish steps are prompted in English: a German learner gets the sentence built whole
  if (activeSourceFor('es') === 'de') return undefined;
  const parts = CHUNKS[itemId];
  if (!parts || parts.length === 0) return undefined;
  if (!parts.every((p) => partFitsSentence(p.es, sentence))) return undefined;
  return parts.map((p) => ({ source: p.en, target: p.es }));
}
