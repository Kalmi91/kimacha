// NY20: a brutalista paletta a téma-kontextuson át képződik le a Colors
// kulcsaira; az alapérték brand, a választás tartós (db), a mód (papír / tinta)
// az Auto / Light / Dark beállítást követi, a classic a mai színeket adja.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));

import { act, render, screen } from '@testing-library/react-native';
import { Text, View } from 'react-native';
import * as RN from 'react-native';

import Colors from '@/constants/Colors';
import { BASE, ON_FILL, PALETTE_FILLS } from '@/constants/GrammarPalettes';
import { BrutalBox, SegmentBar, Sticker, segmentsFilled } from '@/components/grammar/Brutal';
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

describe('paletta-infrastruktúra (NY20)', () => {
  let scheme: jest.SpyInstance;
  beforeEach(async () => {
    scheme = jest.spyOn(RN, 'useColorScheme').mockReturnValue('light');
    await getDb().setGrammarPalette('brand');
  });
  afterEach(() => scheme.mockRestore());

  it('az alapérték brand, világos módban papír, és a Colors[theme] a paletta', async () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    await flush();

    expect(ctx.grammarPalette).toBe('brand');
    expect(ctx.theme).toBe('brand-light');
    const c = Colors[ctx.theme];
    expect(c.background).toBe('#FFFBEA');
    expect(c.card).toBe('#FFFFFF');
    expect(c.text).toBe('#111111');
    expect(c.tint).toBe('#EC4899');
    expect(c.accent).toBe('#EC4899');
    expect(c.secondary).toBe('#22D3EE');
    expect(c.border).toBe('#111111');
    expect(c.onTint).toBe(ON_FILL);
    expect(gc).toMatchObject({ brutal: true, bg: '#FFFBEA', paper: '#FFFFFF', ink: '#111111', mu: '#6B6B6B', a: '#EC4899', b: '#22D3EE', onFill: '#111111' });
  });

  it('sötét módban tinta, az Auto / Light / Dark beállítást követi', async () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    await flush();
    act(() => ctx.setOverride('dark'));
    await flush();
    expect(ctx.theme).toBe('brand-dark');
    expect(Colors[ctx.theme].background).toBe('#111111');
    expect(Colors[ctx.theme].card).toBe('#1C1C1C');
    expect(gc).toMatchObject({ bg: '#111111', paper: '#1C1C1C', ink: '#F5F5F5', mu: '#A0A0A0', onFill: '#111111' });
    act(() => ctx.setOverride('system'));
    await flush();
    expect(ctx.theme).toBe('brand-light');
  });

  it('a választás újratöltés után is megmarad, a régi mentett érték (electric) érvényes', async () => {
    const first = render(<ThemeProvider><Probe /></ThemeProvider>);
    await flush();
    act(() => ctx.setGrammarPalette('electric'));
    await flush();
    expect(ctx.theme).toBe('electric-light');
    expect(await getDb().getGrammarPalette()).toBe('electric');
    first.unmount();

    render(<ThemeProvider><Probe /></ThemeProvider>);
    await flush();
    expect(ctx.grammarPalette).toBe('electric');
    expect(Colors[ctx.theme].tint).toBe('#3D7BFF');
    expect(gc.b).toBe('#FFD23F');
  });

  it('a classic a mai Colors[light|dark] értékeket adja, brutalista formák nélkül', async () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    await flush();
    act(() => ctx.setGrammarPalette('classic'));
    await flush();
    expect(ctx.theme).toBe('light');
    expect(Colors[ctx.theme]).toBe(Colors.light);
    expect(gc.brutal).toBe(false);
    expect(gc.bg).toBe(Colors.light.background);
    expect(gc.a).toBe(Colors.light.tint);
    expect(gc.onFill).toBe(Colors.light.onTint);

    act(() => ctx.setOverride('dark'));
    await flush();
    expect(ctx.theme).toBe('dark');
    expect(Colors[ctx.theme]).toBe(Colors.dark);
    expect(gc.paper).toBe(Colors.dark.card);
  });

  it('a paletta-értékek egyeznek a jóváhagyott táblával', () => {
    expect(BASE.light).toEqual({ bg: '#FFFBEA', paper: '#FFFFFF', ink: '#111111', mu: '#6B6B6B' });
    expect(BASE.dark).toEqual({ bg: '#111111', paper: '#1C1C1C', ink: '#F5F5F5', mu: '#A0A0A0' });
    expect(PALETTE_FILLS).toEqual({
      brand: { a: '#EC4899', b: '#22D3EE' },
      electric: { a: '#3D7BFF', b: '#FFD23F' },
      lime: { a: '#C6FF3D', b: '#FF4FD8' },
      cyan: { a: '#22D3EE', b: '#A78BFA' },
      orange: { a: '#FF8A3D', b: '#2EE6C5' },
    });
  });
});

describe('BrutalBox / Sticker / SegmentBar (NY20)', () => {
  it('a doboz mögé tömör, eltolt ink hátsó View kerül (nem shadow*)', () => {
    render(
      <ThemeProvider>
        <BrutalBox testID="box" fill="a"><Text>x</Text></BrutalBox>
        <BrutalBox testID="closed" dashed><Text>y</Text></BrutalBox>
      </ThemeProvider>
    );
    const box = screen.getByTestId('box');
    const front = RN.StyleSheet.flatten(box.props.style);
    expect(front.borderWidth).toBe(2.5);
    expect(front.shadowOffset).toBeUndefined();
    const backs = screen
      .UNSAFE_getAllByType(View)
      .map((v) => RN.StyleSheet.flatten(v.props.style))
      .filter((st) => st?.position === 'absolute');
    // csak a tömör doboz kap hátsó árnyék-View-t, a zárt (dashed) nem
    expect(backs).toHaveLength(1);
    expect(backs[0]).toMatchObject({ left: 3, top: 3, right: -3, bottom: -3 });
    const closed = screen.getByTestId('closed');
    expect(RN.StyleSheet.flatten(closed.props.style).borderStyle).toBe('dashed');
  });

  it('a matrica el van forgatva, a szegmentált sáv a kész blokkokat tinta-kitöltéssel adja', () => {
    render(
      <ThemeProvider>
        <View>
          <Sticker testID="st" label="core" rotate={-6} />
          <SegmentBar testID="bar" segments={6} filled={segmentsFilled(64, 6)} />
        </View>
      </ThemeProvider>
    );
    expect(RN.StyleSheet.flatten(screen.getByTestId('st').props.style).transform).toEqual([{ rotate: '-6deg' }]);
    const blocks = [0, 1, 2, 3, 4, 5].map((i) => RN.StyleSheet.flatten(screen.getByTestId(`bar-${i}`).props.style).backgroundColor);
    expect(blocks.filter((b) => b !== 'transparent')).toHaveLength(4);
    expect(segmentsFilled(100, 6)).toBe(6);
    expect(segmentsFilled(0, 6)).toBe(0);
  });
});
