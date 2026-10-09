// the theme engine data: contrast gate (every theme × each of its modes), names (en + es),
// groups, onboarding list, Colors keys, match with today's classic / brutal values.

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

// Exemptions: pairs that actually fail and are therefore recorded here (the test checks that they still
// fail; if one gets fixed, the exemption must be deleted). Empty since then: the classic dark onA / a
// (white on #3B82F6 is 3.68) got the dark base color instead of white (4.85).
const KNOWN_EXEMPT = new Set<string>();

function pairs(c: SkinColors): [string, string, string][] {
  const list: [string, string, string][] = [
    ['ink/bg', c.ink, c.bg],
    ['ink/paper', c.ink, c.paper],
    ['mu/bg', c.mu, c.bg],
    // the muted text is readable on the card and in the input field (placeholder) too
    ['mu/paper', c.mu, c.paper],
    ['onA/a', c.onA, c.a],
  ];
  if (c.extra?.field) list.push(['mu/field', c.mu, c.extra.field]);
  if (c.onB && c.b) list.push(['onB/b', c.onB, c.b]);
  return list;
}

describe('contrast gate (theme spec)', () => {
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

  it('the Neo-brutalist sub-palettes (brand, electric, lime, cyan, orange) pass in both modes too', () => {
    for (const p of Object.keys(PALETTE_FILLS) as FillPaletteId[]) {
      const colors = brutalSkinColors(p);
      for (const mode of ['light', 'dark'] as SkinMode[]) {
        for (const [name, fg, bg] of pairs(colors[mode])) {
          expect({ p, mode, pair: name, ok: contrastRatio(fg, bg) >= MIN }).toEqual({ p, mode, pair: name, ok: true });
        }
      }
    }
  });

  it('on the b fill (even without onB) the text is legible, the onB / b ratio >= 4.5', () => {
    for (const id of SKIN_IDS) {
      if (id === 'classic') continue;
      for (const mode of SKINS[id].modes) {
        const g = grammarColorsFor(`${id === 'brutal' ? 'brand' : id}-${mode}` as ThemeKey);
        expect({ id, mode, ok: contrastRatio(g.onB, g.b) >= MIN }).toEqual({ id, mode, ok: true });
      }
    }
  });

  it('bestOn gives the candidate with better contrast', () => {
    expect(bestOn('#B8FF5C', ['#B8FF5C', '#111111'])).toBe('#111111');
    expect(bestOn('#3FA08C', ['#F3E9D2', '#0E1A2B'])).toBe('#0E1A2B');
  });

  it('legibleOn: a passing color is unchanged, a failing one darkens / lightens on the same hue', () => {
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

describe('theme list', () => {
  it('24 themes, each has an en + es name, and so does Custom mix', () => {
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

  it('no inverted ¿ or ¡ in the Spanish names', () => {
    const all = [...Object.values(es.skins.names), ...Object.values(es.skins.groups)].join(' ');
    expect(all).not.toMatch(/[¿¡]/);
  });

  it('the onboarding offer is 5 valid themes, the default is brutal', () => {
    expect(ONBOARDING_SKINS).toEqual(['ukiyoe', 'csillampony', 'szocreal', 'brutal', 'deco']);
    expect(ONBOARDING_SKINS).toHaveLength(5);
    for (const id of ONBOARDING_SKINS) expect(SKINS[id]).toBeDefined();
    expect(DEFAULT_SKIN).toBe('brutal');
  });

  it('the groups together cover exactly the 24 ids, without repetition, and a theme own group matches', () => {
    const flat = SKIN_GROUPS.flatMap((g) => g.skins);
    expect(flat).toHaveLength(24);
    expect([...flat].sort()).toEqual([...SKIN_IDS].sort());
    for (const group of SKIN_GROUPS) {
      for (const id of group.skins) expect(SKINS[id].group).toBe(group.id);
    }
    expect(SKIN_GROUPS.map((g) => g.id)).toEqual(['ajanlott', 'muveszet', 'kultura', 'hangulat', 'olvasas']);
  });

  it('the font names are among the 28 registered names (Spectral-Light instead of ShipporiMincho)', () => {
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

  it('brutal: title / word / body font null, the current system font', () => {
    expect(SKINS.brutal.fonts).toEqual({ title: null, word: null, body: null });
  });

  it('single-mode themes: loteria, retro95, y2k, kawaii, gamer, szocreal, plakat, csillampony, bauhaus, popart, szecesszio, kalocsai, memphis, kodex, graffiti', () => {
    const single = SKIN_IDS.filter((id) => SKINS[id].modes.length === 1).sort();
    expect(single).toEqual(
      ['loteria', 'retro95', 'y2k', 'kawaii', 'gamer', 'szocreal', 'plakat', 'csillampony', 'bauhaus', 'popart', 'szecesszio', 'kalocsai', 'memphis', 'kodex', 'graffiti'].sort()
    );
    expect(SKINS.gamer.modes).toEqual(['dark']);
    expect(SKINS.graffiti.modes).toEqual(['dark']);
    expect(SKINS.deco.modes).toEqual(['dark', 'light']);
  });
});

describe('Colors keys', () => {
  it('for each theme × mode there is a `<id>-<mode>` key (brutal: sub-palette, classic: light / dark), nothing else', () => {
    const expected: string[] = ['light', 'dark'];
    for (const p of Object.keys(PALETTE_FILLS)) expected.push(`${p}-light`, `${p}-dark`);
    for (const id of SKIN_IDS) {
      if (id === 'brutal' || id === 'classic') continue;
      for (const mode of SKINS[id].modes) expected.push(`${id}-${mode}`);
    }
    expect(Object.keys(Colors).sort()).toEqual(expected.sort());
  });

  it('the Colors entry gives the theme colors (text = ink, background = bg, tint = a, card = paper, onTint = onA)', () => {
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

  it('the colors of the classic theme are the current Colors.light / Colors.dark values', () => {
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

  it('the brutal theme is the current BASE + brand values, onA = onB = ON_FILL', () => {
    for (const mode of ['light', 'dark'] as SkinMode[]) {
      expect(SKINS.brutal.colors[mode]).toMatchObject({ ...BASE[mode], a: PALETTE_FILLS.brand.a, b: PALETTE_FILLS.brand.b, onA: '#111111', onB: '#111111' });
    }
  });
});

describe('mode resolution and mix helpers', () => {
  it('for a single-mode theme the setting has no effect, for a dual-mode one Auto / Light / Dark', () => {
    expect(resolveMode(['light'], 'dark', 'dark')).toBe('light');
    expect(resolveMode(['dark'], 'light', 'light')).toBe('dark');
    expect(resolveMode(['light', 'dark'], 'system', 'dark')).toBe('dark');
    expect(resolveMode(['light', 'dark'], 'system', 'light')).toBe('light');
    expect(resolveMode(['dark', 'light'], 'light', 'dark')).toBe('light');
  });

  it('isSkinMix / parseSkinMix: a valid mix passes, an invalid one null', () => {
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

  it('old user: classic palette → classic, anything else → brutal', () => {
    expect(legacySkinFor('classic')).toBe('classic');
    for (const p of ['brand', 'electric', 'lime', 'cyan', 'orange'] as const) expect(legacySkinFor(p)).toBe('brutal');
  });
});
