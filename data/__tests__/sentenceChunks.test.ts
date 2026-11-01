// data/sentences/chunks.json (FB524, reworked for FB538): the shorter sentences each long example sentence is built up
// from ("Mi madre plancha." -> "Mi madre plancha mi camisa."). Every entry must stay true to its sentence: each step is a
// whole sentence of the example's own words (lib/sentenceChunks.ts partFitsSentence, so no word the learner does not know),
// the steps grow, there are at most 2; an empty list = no natural shorter sentence (the sentence is built whole). The
// English is a whole sentence too. The checks run over whatever is in the file.

import chunkData from '@/data/sentences/chunks.json';
import { findPcicItem } from '@/data/pcic';
import { tileWords } from '@/lib/sentenceCards';
import { partFitsSentence } from '@/lib/sentenceChunks';

const CHUNKS = chunkData as Record<string, { es: string; en: string }[]>;
const entries = Object.entries(CHUNKS);
const WHOLE = /^[¿¡"]?[A-ZÁÉÍÓÚÑÜ0-9].*[.!?]"?$/;

describe('data/sentences/chunks.json', () => {
  it('has the first entry, o1113', () => {
    expect(CHUNKS.o1113).toBeDefined();
  });

  it('every key is an existing item with an example sentence, and every step uses only its words, fewer of them', () => {
    const bad = entries.flatMap(([id, parts]) => {
      const sentence = findPcicItem(id)?.exampleEs ?? '';
      if (!sentence) return [`${id}: no example sentence`];
      return parts.filter((p) => !partFitsSentence(p.es, sentence)).map((p) => `${id}: "${p.es}" does not fit "${sentence}"`);
    });
    expect(bad).toEqual([]);
  });

  it('at most 2 steps, each at least 2 words, each longer than the one before', () => {
    const bad = entries.filter(([, parts]) => {
      const lengths = parts.map((p) => tileWords(p.es).length);
      return parts.length > 2 || lengths.some((n, i) => n < 2 || (i > 0 && n <= lengths[i - 1]));
    });
    expect(bad.map(([id]) => id)).toEqual([]);
  });

  it('every step is a whole sentence in both languages (a capital first, an end mark last), not a cut-off piece (FB538)', () => {
    const bad = entries.flatMap(([id, parts]) => parts.filter((p) => !WHOLE.test(p.es.trim()) || !WHOLE.test(p.en.trim())).map((p) => `${id}: ${p.es} / ${p.en}`));
    expect(bad).toEqual([]);
  });
});
