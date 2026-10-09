// The brutalist palette is mapped onto the Colors keys through the theme context;
// the default is brand, the choice is persistent (db), the mode (paper / ink)
// follows the Auto / Light / Dark setting, and classic gives today's colors.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));

import { act, render, screen } from '@testing-library/react-native';
import { Text, View } from 'react-native';
import * as RN from 'react-native';

import Colors from '@/constants/Colors';
import { BASE, ON_FILL, PALETTE_FILLS } from '@/constants/GrammarPalettes';
import { BrutalBox, SegmentBar, Sticker, segmentsFilled } from '@/components/grammar/Brutal';
import { getDb } from '@/lib/database';
import { ThemeProvider, useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';

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

describe('palette infrastructure', () => {
  let scheme: jest.SpyInstance;
  beforeEach(async () => {
    scheme = jest.spyOn(RN, 'useColorScheme').mockReturnValue('light');
    await getDb().setGrammarPalette('brand');
  });
  afterEach(() => scheme.mockRestore());

  it('the default is brand, paper in light mode, and Colors[theme] is the palette', async () => {
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

  it('in dark mode ink, follows the Auto / Light / Dark setting', async () => {
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

  it('the choice persists after reload, the old saved value (electric) is valid', async () => {
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

  it('classic gives the current Colors[light|dark] values, without brutalist shapes', async () => {
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

  it('the palette values match the approved table', () => {
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

describe('BrutalBox / Sticker / SegmentBar', () => {
  it('behind the box goes a solid, offset ink back View (not shadow*)', () => {
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
    // only the solid box gets a back-shadow View, the closed (dashed) one does not
    expect(backs).toHaveLength(1);
    expect(backs[0]).toMatchObject({ left: 3, top: 3, right: -3, bottom: -3 });
    const closed = screen.getByTestId('closed');
    expect(RN.StyleSheet.flatten(closed.props.style).borderStyle).toBe('dashed');
  });

  it('the sticker is rotated, the segmented bar gives the done blocks with ink fill', () => {
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
