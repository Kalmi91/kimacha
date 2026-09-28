// NY11: a paletta a téma-kontextuson át képződik le a Colors kulcsaira; az
// alapérték electric, a választás tartós (db), a classic a mai színeket adja.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));

import { act, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import * as RN from 'react-native';

import Colors from '@/constants/Colors';
import { NEON_PALETTES, NEON_TEXT } from '@/constants/GrammarPalettes';
import { getDb } from '@/lib/database';
import { ThemeProvider, useGrammarColors, useTheme } from '@/lib/ThemeContext';

let ctx: ReturnType<typeof useTheme>;
let gc: ReturnType<typeof useGrammarColors>;

function Probe() {
  ctx = useTheme();
  gc = useGrammarColors();
  return <Text>probe</Text>;
}

const flush = async () => {
  for (let i = 0; i < 4; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('paletta-infrastruktúra (NY11)', () => {
  beforeEach(async () => {
    await getDb().setGrammarPalette('electric');
  });

  it('az alapérték electric, és a Colors[theme] a neon paletta', async () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    await flush();

    expect(ctx.grammarPalette).toBe('electric');
    expect(ctx.theme).toBe('electric');
    const c = Colors[ctx.theme];
    expect(c.background).toBe('#08090D');
    expect(c.card).toBe('#12141C');
    expect(c.tint).toBe('#3D7BFF');
    expect(c.secondary).toBe('#FFD23F');
    expect(c.text).toBe(NEON_TEXT);
    expect(gc.a).toBe(NEON_PALETTES.electric.a);
    expect(gc.on).toBe('#FFFFFF');
  });

  it('a választás újratöltés után is megmarad', async () => {
    const first = render(<ThemeProvider><Probe /></ThemeProvider>);
    await flush();
    act(() => ctx.setGrammarPalette('lime'));
    await flush();
    expect(ctx.theme).toBe('lime');
    expect(await getDb().getGrammarPalette()).toBe('lime');
    first.unmount();

    render(<ThemeProvider><Probe /></ThemeProvider>);
    await flush();
    expect(ctx.grammarPalette).toBe('lime');
    expect(Colors[ctx.theme].tint).toBe('#C6FF3D');
  });

  it('a neon mindig sötét, a rendszer világos beállításától függetlenül', async () => {
    const spy = jest.spyOn(RN, 'useColorScheme').mockReturnValue('light');
    render(<ThemeProvider><Probe /></ThemeProvider>);
    await flush();
    expect(ctx.theme).toBe('electric');
    act(() => ctx.setOverride('light'));
    await flush();
    expect(ctx.theme).toBe('electric');
    spy.mockRestore();
  });

  it('a classic a mai Colors[light|dark] értékeket adja, a téma-váltóval együtt', async () => {
    const spy = jest.spyOn(RN, 'useColorScheme').mockReturnValue('light');
    render(<ThemeProvider><Probe /></ThemeProvider>);
    await flush();
    act(() => ctx.setGrammarPalette('classic'));
    await flush();
    expect(ctx.theme).toBe('light');
    expect(Colors[ctx.theme]).toBe(Colors.light);
    expect(gc.bg).toBe(Colors.light.background);
    expect(gc.a).toBe(Colors.light.tint);
    expect(gc.on).toBe(Colors.light.onTint);

    act(() => ctx.setOverride('dark'));
    await flush();
    expect(ctx.theme).toBe('dark');
    expect(Colors[ctx.theme]).toBe(Colors.dark);
    expect(gc.card).toBe(Colors.dark.card);
    spy.mockRestore();
  });

  it('mind a 6 paletta hex-értéke egyezik a jóváhagyott táblával', () => {
    expect(NEON_PALETTES.brand).toEqual({ bg: '#0F172A', card: '#1A2338', chip: '#243049', a: '#EC4899', b: '#22D3EE', mu: '#94A3B8', tr: '#2A3650', on: '#FFFFFF' });
    expect(NEON_PALETTES.cyan.a).toBe('#22D3EE');
    expect(NEON_PALETTES.orange.b).toBe('#2EE6C5');
    expect(Object.keys(NEON_PALETTES)).toHaveLength(5);
  });
});
