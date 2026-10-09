// The Brutal components (BrutalBox, Sticker, SegmentBar, BrutalButton, BrutalSwitch)
// take the border width / style / colour, the corner and the shadow from the active theme's `shape`;
// the Neo-brutal theme's current values (themePalette.test.tsx) are unchanged.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));

import { act, render, screen } from '@testing-library/react-native';
import { Text, View } from 'react-native';
import * as RN from 'react-native';

import { BrutalBox, BrutalButton, BrutalSwitch, SegmentBar, Sticker, inkButtonText, textOnFill } from '@/components/grammar/Brutal';
import type { SkinId } from '@/constants/Skins';
import { getDb } from '@/lib/database';
import { grammarColorsFor } from '@/lib/grammarColors';
import { ThemeProvider } from '@/lib/ThemeContext';

const flush = async () => {
  for (let i = 0; i < 4; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

const flat = (id: string) => RN.StyleSheet.flatten(screen.getByTestId(id).props.style);

const shadows = () =>
  screen
    .UNSAFE_getAllByType(View)
    .map((v) => RN.StyleSheet.flatten(v.props.style))
    .filter((st) => st?.position === 'absolute');

async function renderWithSkin(skin: SkinId, ui: React.ReactElement) {
  await getDb().setSkin(skin);
  render(<ThemeProvider>{ui}</ThemeProvider>);
  await flush();
}

describe('Brutal components: the shape comes from the theme', () => {
  let scheme: jest.SpyInstance;
  beforeEach(async () => {
    scheme = jest.spyOn(RN, 'useColorScheme').mockReturnValue('light');
    await getDb().setGrammarPalette('brand');
    await getDb().setSkin(null);
  });
  afterEach(() => scheme.mockRestore());

  it('deco: 1 px border in the a color, corner 0, no shadow View', async () => {
    await renderWithSkin('deco', <BrutalBox testID="box" fill="a"><Text>x</Text></BrutalBox>);
    expect(flat('box')).toMatchObject({ borderWidth: 1, borderColor: '#8B6D24', borderStyle: 'solid' });
    expect(flat('box').borderRadius).toBeUndefined();
    expect(shadows()).toHaveLength(0);
  });

  it('memphis: 6 px shadow in the b color, the button corner 999 (pill), the card one 0', async () => {
    await renderWithSkin(
      'memphis',
      <View>
        <BrutalBox testID="card"><Text>x</Text></BrutalBox>
        <BrutalButton testID="btn" label="ok" onPress={() => {}} />
      </View>
    );
    expect(flat('card')).toMatchObject({ borderWidth: 2, borderColor: '#111111' });
    expect(flat('card').borderRadius).toBeUndefined();
    expect(flat('btn')).toMatchObject({ borderRadius: 999 });
    const backs = shadows();
    expect(backs).toHaveLength(2);
    expect(backs[0]).toMatchObject({ left: 6, top: 6, right: -6, bottom: -6, backgroundColor: '#FF5C8A' });
    expect(backs[1]).toMatchObject({ borderRadius: 999 });
  });

  it('szecesszio: per-corner differing radius (70/70/8/8 card, 14/14/4/4 button)', async () => {
    await renderWithSkin(
      'szecesszio',
      <View>
        <BrutalBox testID="card"><Text>x</Text></BrutalBox>
        <BrutalBox testID="btn" kind="button"><Text>y</Text></BrutalBox>
      </View>
    );
    expect(flat('card')).toMatchObject({
      borderTopLeftRadius: 70,
      borderTopRightRadius: 70,
      borderBottomRightRadius: 8,
      borderBottomLeftRadius: 8,
      borderColor: '#1F6F68',
    });
    expect(flat('btn')).toMatchObject({ borderTopLeftRadius: 14, borderBottomRightRadius: 4 });
  });

  it('kalocsai: dashed border in the a color, 10 px corner', async () => {
    await renderWithSkin('kalocsai', <BrutalBox testID="box"><Text>x</Text></BrutalBox>);
    expect(flat('box')).toMatchObject({ borderStyle: 'dashed', borderColor: '#E2231A', borderRadius: 10, borderWidth: 2 });
  });

  it('zen: 0 px border; konnyu: border-color 1 px border, 12 px corner', async () => {
    await renderWithSkin('zen', <BrutalBox testID="box"><Text>x</Text></BrutalBox>);
    expect(flat('box').borderWidth).toBe(0);
  });

  it('konnyu: border-color 1 px border, 12 px corner', async () => {
    await renderWithSkin('konnyu', <BrutalBox testID="box"><Text>x</Text></BrutalBox>);
    expect(flat('box')).toMatchObject({ borderWidth: 1, borderColor: '#E8DFC8', borderRadius: 12 });
  });

  it("the sticker and the segment take the theme's border (at most 2 px), the scaled offset is proportional", async () => {
    await renderWithSkin(
      'memphis',
      <View>
        <Sticker testID="st" label="core" />
        <SegmentBar testID="bar" segments={2} filled={1} />
        <BrutalBox testID="small" offset={2}><Text>z</Text></BrutalBox>
      </View>
    );
    expect(flat('st')).toMatchObject({ borderWidth: 2, borderRadius: 999 });
    expect(flat('bar-0')).toMatchObject({ borderWidth: 2, borderRadius: 4 });
    // memphis shadowOffset = 6, so the shadow of an offset={2} box is 4 px
    expect(shadows().some((st) => st.left === 4 && st.top === 4)).toBe(true);
  });

  it("the switch track follows the theme's border and corner, visible even with a zero border (min 1 px)", async () => {
    await renderWithSkin('zen', <BrutalSwitch testID="sw" value={false} onValueChange={() => {}} />);
    expect(flat('sw').borderWidth).toBe(1);
  });

  it('the current values of the Neo-brutalist theme: 2.5 px ink border, corner 0, 3 px ink shadow, ink button text b / bg', async () => {
    await renderWithSkin('brutal', <BrutalBox testID="box"><Text>x</Text></BrutalBox>);
    expect(flat('box')).toMatchObject({ borderWidth: 2.5, borderColor: '#111111' });
    expect(shadows()[0]).toMatchObject({ left: 3, top: 3, right: -3, bottom: -3, backgroundColor: '#111111' });
    expect(inkButtonText(grammarColorsFor('brand-light'))).toBe('#22D3EE');
    expect(inkButtonText(grammarColorsFor('brand-dark'))).toBe('#111111');
    expect(textOnFill(grammarColorsFor('brand-light'), 'a')).toBe('#111111');
    expect(textOnFill(grammarColorsFor('brand-light'), 'b')).toBe('#111111');
  });

  it('for a new theme the text is onA on a, onB on b, bg on an ink fill', () => {
    const g = grammarColorsFor('kawaii-light');
    expect(textOnFill(g, 'a')).toBe('#1E5E46');
    expect(textOnFill(g, 'b')).toBe('#4B3A80');
    expect(inkButtonText(g)).toBe('#FFF1EC');
    const y = grammarColorsFor('y2k-light');
    expect(textOnFill(y, 'a')).toBe('#B8FF5C');
    expect(textOnFill(y, 'b')).toBe('#111111');
  });
});
