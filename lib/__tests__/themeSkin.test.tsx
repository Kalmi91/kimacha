// The theme engine through the theme context: saving and reloading the choice (skin / My mix),
// migrating an old user (skin NULL: classic → classic, brand → brutal),
// the mode lock of a single-mode theme, and the no-op defaults of useSkin() and the decor frame.

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

describe('theme engine through the context', () => {
  let scheme: jest.SpyInstance;
  beforeEach(async () => {
    scheme = jest.spyOn(RN, 'useColorScheme').mockReturnValue('light');
    await getDb().setGrammarPalette('brand');
    await getDb().setSkin(null);
  });
  afterEach(() => scheme.mockRestore());

  it('default: brutal + brand, the current Colors key and shape', async () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    await flush();
    expect(ctx.skin).toBe('brutal');
    expect(ctx.theme).toBe('brand-light');
    expect(sk.id).toBe('brutal');
    expect(sk.skin.shape).toMatchObject({ borderWidth: 2.5, borderStyle: 'solid', radius: 0, shadowOffset: 3 });
    expect(sk.colors).toMatchObject({ brutal: true, bg: '#FFFBEA', a: '#EC4899', onA: '#111111', onB: '#111111', onInk: '#22D3EE' });
    expect(sk.modeLocked).toBe(false);
  });

  it('old user (skin NULL): classic palette → classic, brand → brutal, cyan → brutal cyan', async () => {
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

  it('the current palette-switch API is unchanged: classic ↔ brutalist palette switches even without choosing a skin', async () => {
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

  it('the chosen theme is saved and comes back after reload; the Colors key is `<id>-<mode>`', async () => {
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

  it('for a dual-mode theme Auto / Light / Dark, for a single-mode one the theme mode stays', async () => {
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

  it('Custom mix: colors, font and shape from separate sources; save + reload', async () => {
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

  it('Custom mix: the colors of a single-mode theme give the theme mode; classic shape = not brutalist', async () => {
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

  it('the skin choice in the db is independent of grammar_palette; setSkin(null) restores the old behavior', async () => {
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

  it('the backup export + import carries the skin and the mix', async () => {
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

describe('decor layers: on a theme without decor a no-op (the current look is unchanged)', () => {
  it('Neo-brutalist and Classic have no registered decor, the slots give the base content', async () => {
    // the 4 starter themes got decor; the themes that give today's look still do not.
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
