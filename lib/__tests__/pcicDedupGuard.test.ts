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

  // PLAN-fb0924 7b javítás (D4 nem teljesült, orkesztrátor 2026-09-24): a
  // sense.es mezők eddig maguk a puszta szó voltak (llevar/llevar/llevar),
  // holott a döntés egy RÖVID, a jelentést egyértelművé tevő KIFEJEZÉS volt
  // (pl. "llevar la bolsa" / "llevar gafas" / "lleva una hora"). Az őr-teszt
  // ezért mostantól ezt kéri számon a puszta "saját es == egyik sense es"
  // egyenlőség helyett: minden sense.es legalább 2 token, és tartalmazza a
  // kártya szavát vagy annak egy ragozott/toldalékolt alakját (ékezet- és
  // kis/nagybetű-független, közös 3+ karakteres tő- vagy részszó-egyezés).
  it('minden sense.es legalább 2 token, és tartalmazza a kártya szavát (vagy ragozott alakját)', () => {
    for (const [id, list] of Object.entries(senses)) {
      const item = findPcicItem(id)!;
      const itemWords = contentWords(item.es);
      for (const sense of list) {
        const tokenCount = stripParens(sense.es).trim().split(/\s+/).filter(Boolean).length;
        expect(tokenCount).toBeGreaterThanOrEqual(2);
        const senseWords = significantWords(sense.es);
        const hasMatch = itemWords.some((iw) => senseWords.some((sw) => sharesStem(iw, sw)));
        expect(hasMatch).toBe(true);
      }
    }
  });
});

// --- helperek a fenti őr-teszthez (ékezet/kisbetű-független tő-egyezés) ---
function stripParens(s: string): string {
  return s.replace(/\([^)]*\)/g, '');
}
function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}
function significantWords(s: string): string[] {
  return (fold(stripParens(s)).match(/[a-z]+/g) ?? []).filter((w) => w.length >= 3);
}
const STOPWORDS = new Set(['de', 'la', 'el', 'un', 'una', 'en', 'con', 'por', 'para', 'se', 'del', 'los', 'las', 'al', 'a', 'que', 'y', 'o', 'lo']);
function contentWords(s: string): string[] {
  const words = significantWords(s);
  const content = words.filter((w) => !STOPWORDS.has(w));
  return content.length > 0 ? content : words;
}
function sharesStem(a: string, b: string): boolean {
  if (a.includes(b) || b.includes(a)) return true;
  const n = Math.max(3, Math.min(a.length, b.length) - 2);
  return a.length >= n && b.length >= n && a.slice(0, n) === b.slice(0, n);
}
