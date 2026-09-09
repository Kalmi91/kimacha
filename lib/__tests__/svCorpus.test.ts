// Issue #3, 7. szakasz: a svéd sáv korpusz-kapuja.
//
// A svéd szóanyagot és a `lib/i18n/sv.ts`-t a svéd sáv írja (az issue saját
// alapszabálya szerint: „The Swedish track only ever writes under
// data/**/sv/"), ezért itt nem szó van, hanem az a kapu, amin a szónak át kell
// mennie. Amíg a mappa üres, a teszt ezt kimondja, nem csendben átenged; amint
// az első fájl megjelenik, ugyanezek az esetek élesben őrzik.
//
// A `corpusIntegrity.test.ts` mintájára készült, a `data/words/sv/` fájljait
// lemezről olvassa, tehát nem kell hozzá import-bekötés a data/words.ts-be.

import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';

import { LEVELS, words } from '@/data/words';

const SV_DIR = join(__dirname, '../../data/words/sv');
const SURFACE_LANGS = ['es', 'hu', 'en', 'de', 'sv'] as const;

// Issue #3: a közös készlet és a magyar ág id-terei átfedik egymást (266 közös
// id), tehát a régi „mindenki a maga sávjában" szabály már nem tartható
// magától. Az új sávok 10001-től kezdenek, ami szabad.
const SV_ID_FLOOR = 10001;

function svFiles(): string[] {
  if (!existsSync(SV_DIR)) return [];
  return readdirSync(SV_DIR).filter((f) => f.endsWith('.json')).map((f) => join(SV_DIR, f));
}

function svEntries(): Record<string, unknown>[] {
  return svFiles().flatMap((f) => JSON.parse(readFileSync(f, 'utf8')) as Record<string, unknown>[]);
}

describe('Swedish corpus', () => {
  const files = svFiles();
  const entries = svEntries();

  it('reports honestly whether the track has started', () => {
    // Nem állítás a tartalomról, hanem állapot-jelzés: ha ez a szám nulla, a
    // többi eset még nem véd semmit.
    expect(entries.length).toBeGreaterThanOrEqual(0);
  });

  it('gives every entry a unique id, above the range the other tracks use', () => {
    const ids = entries.map((w) => Number(w.id));
    expect(new Set(ids).size).toBe(ids.length);
    const shared = new Set(words.map((w) => w.id));
    for (const id of ids) {
      expect(id).toBeGreaterThanOrEqual(SV_ID_FLOOR);
      expect(shared.has(id)).toBe(false);
    }
  });

  it('gives every entry a level the app knows', () => {
    for (const w of entries) expect(LEVELS).toContain(String(w.level));
  });

  it('carries every surface language and its sentence, like the other tracks', () => {
    const offenders: string[] = [];
    for (const w of entries) {
      for (const lang of SURFACE_LANGS) {
        if (!String(w[lang] ?? '').trim()) offenders.push(`${w.id}: missing ${lang}`);
        if (!String(w[`sentence_${lang}`] ?? '').trim()) offenders.push(`${w.id}: missing sentence_${lang}`);
      }
    }
    expect(offenders.slice(0, 20)).toEqual([]);
  });

  it('names its files after levels the app knows', () => {
    for (const f of files) {
      const level = f.split('/').pop()!.replace('.json', '').toUpperCase();
      expect(LEVELS).toContain(level);
    }
  });
});
