// PLAN-temak 2A: a téma-motor a téma-kontextuson át: a választás (skin / Saját mix) mentése és
// visszatöltése, régi felhasználó migrációja (skin NULL: classic → classic, brand → brutal),
// egy módú téma mód-zárolása, a useSkin() és a díszkeret no-op alapértelmezése.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));

import { useEffect } from 'react';
import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import * as RN from 'react-native';

import Colors from '@/constants/Colors';
import { DEFAULT_SKIN_MIX, SKINS } from '@/constants/Skins';
import { SkinBackdrop, SkinCardFrame, SkinHeader, SkinWord } from '@/components/skins/Slots';
import { SKIN_DECOR, decorFor } from '@/components/skins';
import { getDb } from '@/lib/database';
import { ThemeProvider, useTheme } from '@/lib/ThemeContext';
import { useSkin } from '@/lib/useSkin';

let ctx: ReturnType<typeof useTheme>;
let sk: ReturnType<typeof useSkin>;

function Probe() {
  const theme = useTheme();
  const skin = useSkin();
  useEffect(() => {
    ctx = theme;
    sk = skin;
  });
  return <Text>probe</Text>;
}

const flush = async () => {
  for (let i = 0; i < 4; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('téma-motor a kontextuson át (PLAN-temak 2A)', () => {
  let scheme: jest.SpyInstance;
  beforeEach(async () => {
    scheme = jest.spyOn(RN, 'useColorScheme').mockReturnValue('light');
    await getDb().setGrammarPalette('brand');
    await getDb().setSkin(null);
  });
  afterEach(() => scheme.mockRestore());

  it('alapértelmezés: brutal + brand, a mai Colors-kulcs és forma', async () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    await flush();
    expect(ctx.skin).toBe('brutal');
    expect(ctx.theme).toBe('brand-light');
    expect(sk.id).toBe('brutal');
    expect(sk.skin.shape).toMatchObject({ borderWidth: 2.5, borderStyle: 'solid', radius: 0, shadowOffset: 3 });
    expect(sk.colors).toMatchObject({ brutal: true, bg: '#FFFBEA', a: '#EC4899', onA: '#111111', onB: '#111111', onInk: '#22D3EE' });
    expect(sk.modeLocked).toBe(false);
  });

  it('régi felhasználó (skin NULL): classic paletta → classic, brand → brutal, cyan → brutal cyan', async () => {
    await getDb().setGrammarPalette('classic');
    const classic = render(<ThemeProvider><Probe /></ThemeProvider>);
    await flush();
    expect(ctx.skin).toBe('classic');
    expect(['light', 'dark']).toContain(ctx.theme);
    expect(sk.colors.brutal).toBe(false);
    classic.unmount();

    await getDb().setGrammarPalette('brand');
    const brand = render(<ThemeProvider><Probe /></ThemeProvider>);
    await flush();
    expect(ctx.skin).toBe('brutal');
    brand.unmount();

    await getDb().setGrammarPalette('cyan');
    render(<ThemeProvider><Probe /></ThemeProvider>);
    await flush();
    expect(ctx.skin).toBe('brutal');
    expect(ctx.theme).toBe('cyan-light');
  });

  it('a mai paletta-váltó API változatlan: classic ↔ brutális paletta a skin választása nélkül is átvált', async () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    await flush();
    act(() => ctx.setGrammarPalette('classic'));
    await flush();
    expect(ctx.skin).toBe('classic');
    expect(['light', 'dark']).toContain(ctx.theme);
    act(() => ctx.setGrammarPalette('lime'));
    await flush();
    expect(ctx.skin).toBe('brutal');
    expect(ctx.theme).toBe('lime-light');
  });

  it('a választott téma mentődik és újratöltés után visszajön; a Colors-kulcs `<id>-<mód>`', async () => {
    const first = render(<ThemeProvider><Probe /></ThemeProvider>);
    await flush();
    act(() => ctx.setSkin('ukiyoe'));
    await flush();
    expect(ctx.skin).toBe('ukiyoe');
    expect(ctx.theme).toBe('ukiyoe-light');
    expect(Colors[ctx.theme].background).toBe('#EFE6D2');
    expect(await getDb().getSkin()).toBe('ukiyoe');
    first.unmount();

    render(<ThemeProvider><Probe /></ThemeProvider>);
    await flush();
    expect(ctx.skin).toBe('ukiyoe');
    expect(ctx.theme).toBe('ukiyoe-light');
    expect(sk.colors).toMatchObject({ brutal: true, bg: '#EFE6D2', extra: { seal: '#C0392B', wave: '#1F3A5F' } });
  });

  it('kétmódú témánál az Auto / Light / Dark, egy módúnál a téma módja marad', async () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    await flush();
    act(() => ctx.setSkin('deco'));
    await flush();
    expect(ctx.theme).toBe('deco-light');
    act(() => ctx.setOverride('dark'));
    await flush();
    expect(ctx.theme).toBe('deco-dark');
    expect(sk.mode).toBe('dark');

    act(() => ctx.setSkin('loteria'));
    await flush();
    expect(ctx.theme).toBe('loteria-light');
    expect(sk.modeLocked).toBe(true);
    expect(sk.mode).toBe('light');

    act(() => ctx.setSkin('graffiti'));
    await flush();
    act(() => ctx.setOverride('light'));
    await flush();
    expect(ctx.theme).toBe('graffiti-dark');
    expect(sk.modeLocked).toBe(true);
  });

  it('Saját mix: a színek, a betű és a forma külön forrásból; mentés + visszatöltés', async () => {
    const mix = { colors: 'electric', font: 'deco', shape: 'memphis', decor: 'kodex' } as const;
    const first = render(<ThemeProvider><Probe /></ThemeProvider>);
    await flush();
    act(() => {
      ctx.setSkinMix(mix);
      ctx.setSkin('mix');
    });
    await flush();
    expect(ctx.skin).toBe('mix');
    expect(ctx.theme).toBe('electric-light');
    expect(sk.skin.id).toBe('mix');
    expect(sk.skin.fonts.title).toBe('PoiretOne');
    expect(sk.skin.letterSpacing).toBe(3);
    expect(sk.skin.shape).toEqual(SKINS.memphis.shape);
    expect(sk.decorId).toBe('kodex');
    expect(await getDb().getSkinMix()).toEqual(mix);
    first.unmount();

    render(<ThemeProvider><Probe /></ThemeProvider>);
    await flush();
    expect(ctx.skin).toBe('mix');
    expect(ctx.skinMix).toEqual(mix);
    expect(ctx.theme).toBe('electric-light');
  });

  it('Saját mix: egy módú téma színei a téma módját adják; classic forma = nem brutalista', async () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    await flush();
    act(() => {
      ctx.setSkinMix({ colors: 'graffiti', font: 'brutal', shape: 'classic', decor: 'none' });
      ctx.setSkin('mix');
    });
    await flush();
    expect(ctx.theme).toBe('graffiti-dark');
    expect(sk.modeLocked).toBe(true);
    expect(sk.colors.brutal).toBe(false);

    act(() => ctx.setSkinMix({ colors: 'cyan', font: 'brutal', shape: 'deco', decor: 'none' }));
    await flush();
    expect(ctx.theme).toBe('cyan-light');
    expect(sk.colors.brutal).toBe(true);
    expect(ctx.skinMix).toEqual({ colors: 'cyan', font: 'brutal', shape: 'deco', decor: 'none' });
  });

  it('a skin-választás a db-ben a grammar_palette-től független; setSkin(null) visszaáll a régi viselkedésre', async () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    await flush();
    act(() => ctx.setSkin('kodex'));
    await flush();
    act(() => ctx.setGrammarPalette('classic'));
    await flush();
    expect(ctx.skin).toBe('kodex');
    await getDb().setSkin(null);
    expect(await getDb().getSkin()).toBeNull();
    expect(await getDb().getGrammarPalette()).toBe('classic');
  });

  it('a backup exportja + importja átviszi a skin-t és a mixet', async () => {
    const mix = { colors: 'ukiyoe', font: 'zen', shape: 'bauhaus', decor: 'none' } as const;
    await getDb().setSkin('mix');
    await getDb().setSkinMix(mix);
    const payload = await getDb().exportAll();
    expect(payload.tables.user_meta[0]).toMatchObject({ skin: 'mix', skin_mix: JSON.stringify(mix) });
    await getDb().setSkin('deco');
    await getDb().setSkinMix(DEFAULT_SKIN_MIX);
    await getDb().importAll(payload);
    expect(await getDb().getSkin()).toBe('mix');
    expect(await getDb().getSkinMix()).toEqual(mix);
  });
});

describe('dísz-rétegek: dísz nélküli témán no-op (a mai kinézet változatlan)', () => {
  it('a Neo-brutálnak és a Classicnak nincs regisztrált díszük, a slotok az alap tartalmat adják', async () => {
    // PLAN-temak 4D: a 4 kezdő téma díszt kapott; a mai kinézetet adó témák továbbra sem.
    expect(Object.keys(SKIN_DECOR)).toEqual(expect.arrayContaining(['deco', 'szocreal', 'csillampony', 'ukiyoe']));
    expect(Object.keys(SKIN_DECOR)).not.toContain('brutal');
    expect(Object.keys(SKIN_DECOR)).not.toContain('classic');
    expect(decorFor('brutal')).toEqual({});
    expect(decorFor('classic')).toEqual({});
    expect(decorFor('none')).toEqual({});
    render(
      <ThemeProvider>
        <SkinBackdrop />
        <SkinHeader><Text>fejlec</Text></SkinHeader>
        <SkinCardFrame><Text>kartya</Text></SkinCardFrame>
        <SkinWord word="casa"><Text>casa</Text></SkinWord>
      </ThemeProvider>
    );
    await flush();
    expect(screen.getByText('fejlec')).toBeTruthy();
    expect(screen.getByText('kartya')).toBeTruthy();
    expect(screen.getByText('casa')).toBeTruthy();
  });
});
