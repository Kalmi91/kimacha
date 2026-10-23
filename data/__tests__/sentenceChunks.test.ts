// data/sentences/chunks.json (FB524): the parts of the long example sentences. Every entry must stay true to its sentence:
// the Spanish parts joined by a space are exactly the item's example, the part count fits the length, every part is at
// least 2 words, the English is a bare phrase. The file grows (1500+ entries), so the checks run over whatever is in it.

import chunkData from '@/data/sentences/chunks.json';
import { findPcicItem } from '@/data/pcic';
import { tileWords } from '@/lib/sentenceCards';

const CHUNKS = chunkData as Record<string, { es: string; en: string }[]>;
const entries = Object.entries(CHUNKS);

describe('data/sentences/chunks.json', () => {
  it('has the first entry, o1113', () => {
    expect(CHUNKS.o1113).toBeDefined();
  });

  it('every key is an existing item with an example sentence, and the parts joined by a space are exactly that sentence', () => {
    for (const [id, parts] of entries) {
      const item = findPcicItem(id);
      expect(item).toBeDefined();
      expect(parts.map((p) => p.es).join(' ')).toBe(item?.exampleEs?.trim());
    }
  });

  it('the number of parts fits the length: up to 4 words none, 5-6 two, 7-8 two or three, 9+ three', () => {
    for (const [id, parts] of entries) {
      const words = tileWords(findPcicItem(id)?.exampleEs ?? '').length;
      expect(words).toBeGreaterThanOrEqual(5);
      if (words <= 6) expect(parts).toHaveLength(2);
      else if (words <= 8) expect([2, 3]).toContain(parts.length);
      else expect(parts).toHaveLength(3);
    }
  });

  it('every Spanish part is at least 2 words (as tiles), every English part is a non-empty phrase with no full stop at the end', () => {
    for (const [, parts] of entries) {
      for (const p of parts) {
        expect(tileWords(p.es).length).toBeGreaterThanOrEqual(2);
        expect(p.en.trim()).not.toBe('');
        expect(p.en.trim().endsWith('.')).toBe(false);
      }
    }
  });
});
