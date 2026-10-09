// a téma-motor adata: kontraszt-kapu (minden téma × minden módja), nevek (en + es),
// csoportok, onboarding-lista, Colors-kulcsok, a mai classic / brutal értékek egyezése.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));

import Colors from '../Colors';
import { BASE, PALETTE_FILLS, type FillPaletteId } from '../GrammarPalettes';
import {
  DEFAULT_SKIN,
  ONBOARDING_SKINS,
  SKINS,
  SKIN_GROUPS,
  SKIN_IDS,
  bestOn,
  brutalSkinColors,
  contrastRatio,
  isSkinMix,
  legacySkinFor,
  legibleOn,
  parseSkinMix,
  resolveMode,
  skinColorsFor,
  type SkinColors,
  type SkinMode,
} from '../Skins';
import { grammarColorsFor } from '@/lib/grammarColors';
import en from '@/lib/i18n/en';
import es from '@/lib/i18n/es';
import type { ThemeKey } from '@/lib/ThemeContext';

const MIN = 4.5;

// Kivételek: olyan pár, ami ténylegesen bukik és ezért itt rögzített (a teszt ellenőrzi, hogy még
// bukik; ha javítják, a kivételt törölni kell). Utána üres: a classic sötét onA / a
// (fehér a #3B82F6-on 3,68) a fehér helyett a sötét alap-színt kapta (4,85).
const KNOWN_EXEMPT = new Set<string>();

function pairs(c: SkinColors): [string, string, string][] {
  const list: [string, string, string][] = [
    ['ink/bg', c.ink, c.bg],
    ['ink/paper', c.ink, c.paper],
    ['mu/bg', c.mu, c.bg],
    // a halvány szöveg a kártyán és a beviteli mezőben (placeholder) is olvasható
    ['mu/paper', c.mu, c.paper],
    ['onA/a', c.onA, c.a],
  ];
  if (c.extra?.field) list.push(['mu/field', c.mu, c.extra.field]);
  if (c.onB && c.b) list.push(['onB/b', c.onB, c.b]);
  return list;
}

describe('kontraszt-kapu (PLAN-temak Téma-spec)', () => {
  for (const id of SKIN_IDS) {
    for (const mode of SKINS[id].modes) {
      it(`${id} / ${mode}: ink/bg, ink/paper, mu/bg, mu/paper, mu/field, onA/a, onB/b >= ${MIN}`, () => {
        for (const [name, fg, bg] of pairs(skinColorsFor(SKINS[id], mode))) {
          const ratio = contrastRatio(fg, bg);
          if (KNOWN_EXEMPT.has(`${id}/${mode} ${name}`)) {
            expect(ratio).toBeLessThan(MIN);
          } else {
            expect({ pair: name, fg, bg, ok: ratio >= MIN }).toEqual({ pair: name, fg, bg, ok: true });
          }
        }
      });
    }
  }

  it('a Neo-brutál al-paletták (brand, electric, lime, cyan, orange) is átmennek mindkét módban', () => {
    for (const p of Object.keys(PALETTE_FILLS) as FillPaletteId[]) {
      const colors = brutalSkinColors(p);
      for (const mode of ['light', 'dark'] as SkinMode[]) {
        for (const [name, fg, bg] of pairs(colors[mode])) {
          expect({ p, mode, pair: name, ok: contrastRatio(fg, bg) >= MIN }).toEqual({ p, mode, pair: name, ok: true });
        }
      }
    }
  });

  it('a b kitöltésen (onB nélkül is) olvasható a szöveg, az onB / b arány >= 4,5', () => {
    for (const id of SKIN_IDS) {
      if (id === 'classic') continue;
      for (const mode of SKINS[id].modes) {
        const g = grammarColorsFor(`${id === 'brutal' ? 'brand' : id}-${mode}` as ThemeKey);
        expect({ id, mode, ok: contrastRatio(g.onB, g.b) >= MIN }).toEqual({ id, mode, ok: true });
      }
    }
  });

  it('bestOn a jobb kontrasztú jelöltet adja', () => {
    expect(bestOn('#B8FF5C', ['#B8FF5C', '#111111'])).toBe('#111111');
    expect(bestOn('#3FA08C', ['#F3E9D2', '#0E1A2B'])).toBe('#0E1A2B');
  });

  it('legibleOn: az átmenő szín változatlan, a bukó azonos árnyalaton sötétedik / világosodik', () => {
    expect(legibleOn('#15803D', '#FFFFFF')).toBe('#15803D');
    for (const [fg, bg] of [['#EAB308', '#FFFFFF'], ['#7C3AED', '#1E293B'], ['#38BDF8', '#FFFFFF'], ['#F472B6', '#FFFFFF']]) {
      const out = legibleOn(fg, bg);
      expect({ fg, bg, ok: contrastRatio(out, bg) >= MIN }).toEqual({ fg, bg, ok: true });
    }
    expect(legibleOn('#BFF0DC', '#FFF1EC', 3)).not.toBe('#BFF0DC');
    expect(contrastRatio(legibleOn('#BFF0DC', '#FFF1EC', 3), '#FFF1EC')).toBeGreaterThanOrEqual(3);
    expect(legibleOn('rgba(0,0,0,0.5)', '#FFFFFF')).toBe('rgba(0,0,0,0.5)');
  });
});

describe('téma-lista', () => {
  it('24 téma, mindegyiknek van en + es neve, és a Saját mixnek is', () => {
    expect(SKIN_IDS).toHaveLength(24);
    for (const id of [...SKIN_IDS, 'mix'] as const) {
      expect(en.skins.names[id]).toBeTruthy();
      expect(es.skins.names[id]).toBeTruthy();
    }
    for (const group of SKIN_GROUPS) {
      expect(en.skins.groups[group.id]).toBeTruthy();
      expect(es.skins.groups[group.id]).toBeTruthy();
    }
  });

  it('a spanyol nevekben nincs fordított ¿ vagy ¡', () => {
    const all = [...Object.values(es.skins.names), ...Object.values(es.skins.groups)].join(' ');
    expect(all).not.toMatch(/[¿¡]/);
  });

  it('az onboarding-ajánlat 5 érvényes téma, az alapértelmezés a brutal', () => {
    expect(ONBOARDING_SKINS).toEqual(['ukiyoe', 'csillampony', 'szocreal', 'brutal', 'deco']);
    expect(ONBOARDING_SKINS).toHaveLength(5);
    for (const id of ONBOARDING_SKINS) expect(SKINS[id]).toBeDefined();
    expect(DEFAULT_SKIN).toBe('brutal');
  });

  it('a csoportok együtt pontosan a 24 id-t fedik, ismétlés nélkül, és a téma saját csoportja egyezik', () => {
    const flat = SKIN_GROUPS.flatMap((g) => g.skins);
    expect(flat).toHaveLength(24);
    expect([...flat].sort()).toEqual([...SKIN_IDS].sort());
    for (const group of SKIN_GROUPS) {
      for (const id of group.skins) expect(SKINS[id].group).toBe(group.id);
    }
    expect(SKIN_GROUPS.map((g) => g.id)).toEqual(['ajanlott', 'muveszet', 'kultura', 'hangulat', 'olvasas']);
  });

  it('a betű-nevek a regisztrált 28 név egyikei (a ShipporiMincho helyett Spectral-Light)', () => {
    const registered = new Set([
      'PoiretOne', 'JosefinSans', 'AlfaSlabOne', 'Atkinson', 'Atkinson-Bold', 'Lexend', 'VT323',
      'Syne-ExtraBold', 'Fredoka-Medium', 'Orbitron-Bold', 'Cormorant-MediumItalic', 'Spectral-Light', 'Playfair-Black',
      'Oswald-Bold', 'RussoOne', 'Pacifico', 'Jost', 'Jost-Bold', 'Bangers', 'CinzelDecorative-Bold', 'Marcellus',
      'YesevaOne', 'RubikMonoOne', 'UnifrakturMaguntia', 'IMFellEnglish', 'RubikSprayPaint', 'PermanentMarker', 'OpenDyslexic',
    ]);
    for (const id of SKIN_IDS) {
      for (const name of Object.values(SKINS[id].fonts)) {
        if (name !== null) expect(registered.has(name)).toBe(true);
      }
    }
  });

  it('brutal: title / word / body betű null, a mai rendszer-betű (PLAN-temak 6E, Kálmán 2a)', () => {
    expect(SKINS.brutal.fonts).toEqual({ title: null, word: null, body: null });
  });

  it('egy módú témák: loteria, retro95, y2k, kawaii, gamer, szocreal, plakat, csillampony, bauhaus, popart, szecesszio, kalocsai, memphis, kodex, graffiti', () => {
    const single = SKIN_IDS.filter((id) => SKINS[id].modes.length === 1).sort();
    expect(single).toEqual(
      ['loteria', 'retro95', 'y2k', 'kawaii', 'gamer', 'szocreal', 'plakat', 'csillampony', 'bauhaus', 'popart', 'szecesszio', 'kalocsai', 'memphis', 'kodex', 'graffiti'].sort()
    );
    expect(SKINS.gamer.modes).toEqual(['dark']);
    expect(SKINS.graffiti.modes).toEqual(['dark']);
    expect(SKINS.deco.modes).toEqual(['dark', 'light']);
  });
});

describe('Colors-kulcsok', () => {
  it('minden téma × módjához van `<id>-<mód>` kulcs (brutal: al-paletta, classic: light / dark), semmi más', () => {
    const expected: string[] = ['light', 'dark'];
    for (const p of Object.keys(PALETTE_FILLS)) expected.push(`${p}-light`, `${p}-dark`);
    for (const id of SKIN_IDS) {
      if (id === 'brutal' || id === 'classic') continue;
      for (const mode of SKINS[id].modes) expected.push(`${id}-${mode}`);
    }
    expect(Object.keys(Colors).sort()).toEqual(expected.sort());
  });

  it('a Colors-bejegyzés a téma színeit adja (text = ink, background = bg, tint = a, card = paper, onTint = onA)', () => {
    for (const id of SKIN_IDS) {
      if (id === 'brutal' || id === 'classic') continue;
      for (const mode of SKINS[id].modes) {
        const c = skinColorsFor(SKINS[id], mode);
        const entry = Colors[`${id}-${mode}` as ThemeKey];
        expect(entry).toMatchObject({
          text: c.ink,
          background: c.bg,
          tint: c.a,
          card: c.paper,
          textMuted: c.mu,
          onTint: c.onA,
          border: c.border ?? c.ink,
          secondary: c.b ?? c.a,
        });
      }
    }
  });

  it('a classic téma színei a mai Colors.light / Colors.dark értékei', () => {
    for (const mode of ['light', 'dark'] as SkinMode[]) {
      const c = SKINS.classic.colors[mode] as SkinColors;
      const entry = Colors[mode];
      expect({ bg: c.bg, paper: c.paper, ink: c.ink, mu: c.mu, a: c.a, onA: c.onA, b: c.b }).toEqual({
        bg: entry.background,
        paper: entry.card,
        ink: entry.text,
        mu: entry.textMuted,
        a: entry.tint,
        onA: entry.onTint,
        b: entry.accent,
      });
    }
  });

  it('a brutal téma a mai BASE + brand értékek, onA = onB = ON_FILL', () => {
    for (const mode of ['light', 'dark'] as SkinMode[]) {
      expect(SKINS.brutal.colors[mode]).toMatchObject({ ...BASE[mode], a: PALETTE_FILLS.brand.a, b: PALETTE_FILLS.brand.b, onA: '#111111', onB: '#111111' });
    }
  });
});

describe('mód-feloldás és mix-segédek', () => {
  it('egy módú témánál a beállítás hatástalan, kétmódúnál az Auto / Light / Dark', () => {
    expect(resolveMode(['light'], 'dark', 'dark')).toBe('light');
    expect(resolveMode(['dark'], 'light', 'light')).toBe('dark');
    expect(resolveMode(['light', 'dark'], 'system', 'dark')).toBe('dark');
    expect(resolveMode(['light', 'dark'], 'system', 'light')).toBe('light');
    expect(resolveMode(['dark', 'light'], 'light', 'dark')).toBe('light');
  });

  it('isSkinMix / parseSkinMix: érvényes mix átmegy, érvénytelen null', () => {
    const mix = { colors: 'electric', font: 'deco', shape: 'memphis', decor: 'none' };
    expect(isSkinMix(mix)).toBe(true);
    expect(isSkinMix({ ...mix, colors: 'ukiyoe', decor: 'kodex' })).toBe(true);
    expect(isSkinMix({ ...mix, font: 'nincs' })).toBe(false);
    expect(isSkinMix({ ...mix, colors: 'mix' })).toBe(false);
    expect(isSkinMix(null)).toBe(false);
    expect(parseSkinMix(JSON.stringify(mix))).toEqual(mix);
    expect(parseSkinMix('{rossz')).toBeNull();
    expect(parseSkinMix(null)).toBeNull();
  });

  it('régi felhasználó: classic paletta → classic, minden más → brutal', () => {
    expect(legacySkinFor('classic')).toBe('classic');
    for (const p of ['brand', 'electric', 'lime', 'cyan', 'orange'] as const) expect(legacySkinFor(p)).toBe('brutal');
  });
});
