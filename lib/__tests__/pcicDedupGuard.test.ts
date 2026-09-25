// PLAN-fb0924 7b. lépés (FB384, D3+D4) őr-tesztje: egy spanyol szó (word/
// phrase kind) csak EGY PCIC-tételként létezzen, a betöltött korpusz teljes
// egészén (szintek közt ÉS szinten belül), és a senses.json minden kulcsa
// létező item-id legyen.

import sensesRaw from '@/data/pcic/senses.json';
import { findPcicItem, pcicItemsForLevel, PCIC_LEVELS } from '@/data/pcic';
import { normalizeForLevelFit } from '../pcicLevelFit';

describe('nincs két word/phrase tétel azonos normalizált es-sel (FB384, 7b)', () => {
  it('a teljes betöltött korpuszon (minden szinten együtt) egyedi a normalizált es', () => {
    const seen = new Map<string, string>(); // normEs -> id
    const dupes: string[] = [];
    for (const level of PCIC_LEVELS) {
      for (const item of pcicItemsForLevel(level)) {
        if (item.kind !== 'word' && item.kind !== 'phrase') continue;
        const key = normalizeForLevelFit(item.es);
        if (!key) continue;
        if (seen.has(key)) {
          dupes.push(`${key}: ${seen.get(key)} vs ${item.id}`);
        } else {
          seen.set(key, item.id);
        }
      }
    }
    expect(dupes).toEqual([]);
  });
});

describe('data/pcic/senses.json (FB384, D4)', () => {
  const senses = sensesRaw as Record<string, { en: string; es: string }[]>;

  it('minden kulcs egy valódi, betöltött PCIC-item id', () => {
    for (const id of Object.keys(senses)) {
      expect(findPcicItem(id)).toBeDefined();
    }
  });

  it('minden jelentés-lista legalább 2 elemű (különben nincs értelme sense-listának)', () => {
    for (const [id, list] of Object.entries(senses)) {
      expect(list.length).toBeGreaterThanOrEqual(2);
      for (const sense of list) {
        expect(sense.en.length).toBeGreaterThan(0);
        expect(sense.es.length).toBeGreaterThan(0);
      }
    }
  });

  it('a jelentés-listás item saját es-e megegyezik az egyik sense es-ével', () => {
    for (const [id, list] of Object.entries(senses)) {
      const item = findPcicItem(id)!;
      expect(list.some((sense) => sense.es === item.es)).toBe(true);
    }
  });
});
