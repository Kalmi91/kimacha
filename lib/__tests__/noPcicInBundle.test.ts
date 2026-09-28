// PLAN-ketiranyu 2. lépés (2026-09-28): a valódi PCIC-korpusz (data/pcic/*.json
// nyers fájlok + a data/pcicCorpus.ts rejtett modul, ami VÁLTOZATLANUL a régi
// data/pcic.ts tartalmát viszi tovább) mostantól csak teszt és script
// importálhatja - az élő appnak data/pcic.ts adja a szócsalád-alapú
// gyakorisági korpuszt. Ez az őr-teszt végigmegy az app/lib/components/data
// forráson (a tesztfájlokat kihagyva), és elbukik, ha bármelyik NEM-teszt
// modul mégis a nyers PCIC-mappát vagy a pcicCorpus modult importálja - a
// data/pcicCorpus.ts saját magát (a nyers importok forrása) kihagyja.

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = join(__dirname, '..', '..');
const SCAN_DIRS = ['app', 'lib', 'components', 'data'];
const SOURCE_EXT = /\.(ts|tsx)$/;
const IS_TEST_FILE = /(^|\/)__tests__\//;
const IS_TEST_SUFFIX = /\.test\.tsx?$/;
// data/pcicCorpus.ts a saját nyers PCIC-importjait hordozza (ez a modul
// egyetlen dolga), ezért ez az egy fájl kimarad az ellenőrzésből.
const EXEMPT = new Set(['data/pcicCorpus.ts']);

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...collectSourceFiles(full));
    } else if (SOURCE_EXT.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

// Minden `from '...'`/`require('...')` importforrás-string a fájlban.
const IMPORT_SOURCE_RE = /(?:from|require\()\s*['"]([^'"]+)['"]/g;

function isForbiddenImport(source: string): boolean {
  // Nyers PCIC-json a data/pcic/ mappából (alias, relatív, bármely mélységből).
  if (/\/pcic\/[^/]+\.json$/.test(source)) return true;
  // A rejtett pcicCorpus modul, kiterjesztés nélküli TS-import mintában.
  if (/(^|\/)pcicCorpus$/.test(source)) return true;
  return false;
}

describe('nincs élő importja a nyers PCIC-korpusznak (PLAN-ketiranyu 2. lépés)', () => {
  const offenders: string[] = [];

  for (const dir of SCAN_DIRS) {
    for (const file of collectSourceFiles(join(ROOT, dir))) {
      const relPath = relative(ROOT, file).replace(/\\/g, '/');
      if (IS_TEST_FILE.test(relPath) || IS_TEST_SUFFIX.test(relPath)) continue;
      if (EXEMPT.has(relPath)) continue;

      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(IMPORT_SOURCE_RE)) {
        const source = match[1];
        if (isForbiddenImport(source)) {
          offenders.push(`${relPath}: "${source}"`);
        }
      }
    }
  }

  it('app/lib/components/data egyetlen nem-teszt fájlja sem importál data/pcic/*.json-t vagy pcicCorpus-t', () => {
    expect(offenders).toEqual([]);
  });
});
