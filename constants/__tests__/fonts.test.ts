// PLAN-temak 2B: minden regisztrált betűhöz van fájl és licenc, a fájlok léteznek és
// valódi betűfájlok (nem letöltési hibaoldal).

import { existsSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

import { FONT_FILES, FONT_LICENSES, FONT_NAMES } from '../Fonts';

const ROOT = join(__dirname, '..', '..');
const FONTS_TS = readFileSync(join(ROOT, 'constants', 'Fonts.ts'), 'utf8');

describe('constants/Fonts.ts', () => {
  it('29 egyedi betűnév, a PLAN-temak 2B listája (ShipporiMincho helyett Spectral-Light)', () => {
    expect(FONT_NAMES).toHaveLength(29);
    expect(new Set(FONT_NAMES).size).toBe(FONT_NAMES.length);
    expect(FONT_NAMES).toContain('Spectral-Light');
    expect(FONT_NAMES).not.toContain('ShipporiMincho');
    for (const name of ['Atkinson', 'Atkinson-Bold', 'Jost', 'Jost-Bold', 'OpenDyslexic', 'VT323']) {
      expect(FONT_NAMES).toContain(name);
    }
  });

  it('minden FONT_NAMES-hez van require és licenc, és semmi extra', () => {
    for (const name of FONT_NAMES) {
      expect(FONT_FILES[name]).toBeDefined();
      const lic = FONT_LICENSES[name];
      expect(lic.family.length).toBeGreaterThan(0);
      expect(lic.license.length).toBeGreaterThan(0);
      expect(lic.url).toMatch(/^https:\/\//);
    }
    expect(Object.keys(FONT_FILES).sort()).toEqual([...FONT_NAMES].sort());
    expect(Object.keys(FONT_LICENSES).sort()).toEqual([...FONT_NAMES].sort());
  });

  it('a hivatkozott betűfájlok léteznek, érvényes TTF/OTF fejléccel', () => {
    const paths = [...FONTS_TS.matchAll(/require\('\.\.\/assets\/fonts\/([^']+)'\)/g)].map((m) => m[1]);
    expect(paths).toHaveLength(FONT_NAMES.length);
    expect(new Set(paths).size).toBe(paths.length);
    for (const file of paths) {
      const full = join(ROOT, 'assets', 'fonts', file);
      expect(existsSync(full)).toBe(true);
      expect(statSync(full).size).toBeGreaterThan(10_000);
      const head = readFileSync(full).subarray(0, 4).toString('latin1');
      // TTF: 00 01 00 00, OTF (CFF): "OTTO"
      expect(head === '\u0000\u0001\u0000\u0000' || head === 'OTTO').toBe(true);
    }
  });

  it('a _layout.tsx useFonts-ja megkapja a FONT_FILES-t, a SpaceMono marad', () => {
    const layout = readFileSync(join(ROOT, 'app', '_layout.tsx'), 'utf8');
    expect(layout).toContain('...FONT_FILES');
    expect(layout).toContain("SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf')");
  });
});
