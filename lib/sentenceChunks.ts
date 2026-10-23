// The parts a long example sentence is split into on the Sentences tab (FB524): the learner builds each part from tiles
// before building the whole sentence. The parts are data (data/sentences/chunks.json, keyed by item id), written
// per sentence; a sentence with no entry (short ones, or not written yet) is simply built whole.

import chunkData from '@/data/sentences/chunks.json';
import type { PcicTarget } from '@/data/pcic';

/** One part of a sentence: `source` is its English (the prompt), `target` the Spanish part to build. */
export interface SentenceChunk {
  source: string;
  target: string;
}

const CHUNKS = chunkData as Record<string, { es: string; en: string }[]>;

/**
 * The parts of the item's example sentence, or undefined (no parts written, the other direction, or the data no longer
 * matches the sentence: the Spanish parts joined by a space must be exactly the sentence). Only the Spanish direction.
 */
export function chunksFor(itemId: string, target: PcicTarget, sentence: string): SentenceChunk[] | undefined {
  if (target !== 'es') return undefined;
  const parts = CHUNKS[itemId];
  if (!parts || parts.length === 0) return undefined;
  if (parts.map((p) => p.es).join(' ') !== sentence.trim()) return undefined;
  return parts.map((p) => ({ source: p.en, target: p.es }));
}
