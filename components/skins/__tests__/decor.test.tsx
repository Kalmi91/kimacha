// the decorations of the 4 starter themes (deco, szocreal, csillampony, ukiyoe): the slots draw
// the decoration around the base content, with plain View/Text, no SVG and no new native dependency.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));

import fs from 'fs';
import path from 'path';

import { act, render } from '@testing-library/react-native';
import * as RN from 'react-native';
import { Text } from 'react-native';

import { SKIN_DECOR } from '@/components/skins';
import { RAINBOW } from '@/components/skins/csillampony';
import { SkinBackdrop, SkinCardFrame, SkinHeader, SkinWord } from '@/components/skins/Slots';
import { SKINS, type SkinId } from '@/constants/Skins';
import { getDb } from '@/lib/database';
import { ThemeProvider } from '@/lib/ThemeContext';

jest.setTimeout(30000);

const flush = async () => {
  for (let i = 0; i < 6; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

const flat = (style: unknown) => RN.StyleSheet.flatten(style as RN.StyleProp<RN.ViewStyle & RN.TextStyle>);

async function mountSkin(skin: SkinId) {
  await getDb().setSkin(skin);
  const view = render(
    <ThemeProvider>
      <SkinBackdrop />
      <SkinHeader>
        <Text>fejlec</Text>
      </SkinHeader>
      <SkinCardFrame>
        <Text>kartya</Text>
      </SkinCardFrame>
      <SkinWord word="casa">
        <Text>casa</Text>
      </SkinWord>
    </ThemeProvider>,
  );
  await flush();
  // the base content always stays around the decoration
  for (const text of ['fejlec', 'kartya', 'casa']) expect(view.getByText(text)).toBeTruthy();
  return view;
}

describe('a 4 kezdő téma díszei (PLAN-temak 4D)', () => {
  let scheme: jest.SpyInstance;
  beforeEach(async () => {
    scheme = jest.spyOn(RN, 'useColorScheme').mockReturnValue('light');
    await getDb().setGrammarPalette('brand');
  });
  afterEach(async () => {
    scheme.mockRestore();
    await getDb().setSkin(null);
  });

  it('a regiszter a 4 témát tölti, mindegyiknek van legalább egy slotja', () => {
    for (const id of ['deco', 'szocreal', 'csillampony', 'ukiyoe'] as const) {
      const decor = SKIN_DECOR[id];
      expect(decor).toBeDefined();
      expect(Object.keys(decor ?? {}).length).toBeGreaterThan(0);
    }
  });

  it('deco: dupla keret (külső + 4 px rés + belső 1 px a), napsugár-legyező, rombusz-elválasztó', async () => {
    const view = await mountSkin('deco');
    const a = SKINS.deco.colors.light?.a;
    expect(view.getByTestId('skin-deco-frame')).toBeTruthy();
    expect(flat(view.getByTestId('decor-deco-inner').props.style)).toMatchObject({
      top: 5,
      left: 5,
      right: 5,
      bottom: 5,
      borderWidth: 1,
      borderColor: a,
    });
    expect(view.getAllByTestId('decor-deco-rays-ray')).toHaveLength(9);
    expect(view.getByTestId('decor-deco-divider')).toBeTruthy();
    view.unmount();
  });

  it('szocreal: belső 3 px b keret a 4 px ink keret alatt, felkelő nap, Élmunkás jelvény, Napi terv sáv', async () => {
    const view = await mountSkin('szocreal');
    expect(flat(view.getByTestId('decor-szocreal-inner').props.style)).toMatchObject({
      top: 7,
      borderWidth: 3,
      borderColor: SKINS.szocreal.colors.light?.b,
    });
    expect(view.getByTestId('decor-szocreal-sun')).toBeTruthy();
    expect(view.getAllByTestId('decor-szocreal-rays-ray')).toHaveLength(9);
    expect(view.getByText('★ Shock worker')).toBeTruthy();
    expect(view.getByTestId('skin-szocreal-plan-label').props.children.join('')).toBe('Daily plan 0%');
    expect(flat(view.getByTestId('skin-szocreal-plan-fill').props.style).width).toBe('0%');
    view.unmount();
  });

  it('szocreal: a Napi terv a mai percekből számol, a felirat 100% fölé is megy, a sáv 100%-nál megáll', async () => {
    await getDb().setWeeklyGoalMinutes(60);
    for (let i = 0; i < 9; i++) await getDb().addUsageMinute();
    const view = await mountSkin('szocreal');
    expect(view.getByTestId('skin-szocreal-plan-label').props.children.join('')).toBe('Daily plan 105%');
    expect(flat(view.getByTestId('skin-szocreal-plan-fill').props.style).width).toBe('100%');
    view.unmount();
  });

  it('csillampony: 6 sávos szivárvány a spec színeivel, csillám-pöttyök, ló-ikon a fejlécben', async () => {
    const view = await mountSkin('csillampony');
    const bands = view.getAllByTestId('decor-csillampony-band');
    expect(bands.map((b) => flat(b.props.style).borderColor)).toEqual(RAINBOW);
    expect(RAINBOW).toEqual(['#FF6EC7', '#FFB347', '#FFE066', '#7BE0AD', '#7FB8FF', '#C9A7FF']);
    // the outer band is the largest semicircle
    const widths = bands.map((b) => flat(b.props.style).width as number);
    expect([...widths].sort((x, y) => y - x)).toEqual(widths);
    expect(view.getByTestId('decor-csillampony-sparkles')).toBeTruthy();
    expect(view.getByText('🐴')).toBeTruthy();
    view.unmount();
  });

  it('ukiyoe: két sor félkör-hullám a kártya alján, piros pecsét (語) jobb fent', async () => {
    const view = await mountSkin('ukiyoe');
    const discs = view.getAllByTestId('decor-ukiyoe-disc');
    expect(discs).toHaveLength(40);
    expect(flat(discs[discs.length - 1].props.style).backgroundColor).toBe(SKINS.ukiyoe.colors.light?.extra?.wave);
    expect(view.getByText('語')).toBeTruthy();
    expect(flat(view.getByTestId('decor-ukiyoe-seal').props.style)).toMatchObject({
      backgroundColor: SKINS.ukiyoe.colors.light?.extra?.seal,
    });
    view.unmount();
  });

  it('sötét módban a téma saját dísz-színeit használja (ukiyoe hullám + pecsét)', async () => {
    await getDb().setSkin('ukiyoe');
    scheme.mockReturnValue('dark');
    const view = render(
      <ThemeProvider>
        <SkinCardFrame>
          <Text>kartya</Text>
        </SkinCardFrame>
      </ThemeProvider>,
    );
    await flush();
    const discs = view.getAllByTestId('decor-ukiyoe-disc');
    expect(flat(discs[0].props.style).backgroundColor).toBe(SKINS.ukiyoe.colors.dark?.extra?.wave);
    expect(flat(view.getByTestId('decor-ukiyoe-seal').props.style).backgroundColor).toBe(SKINS.ukiyoe.colors.dark?.extra?.seal);
    view.unmount();
  });

  it('a díszek fájljai csak View / Text-et használnak: nincs SVG, expo-image vagy más natív függőség', () => {
    const dir = path.join(__dirname, '..');
    for (const file of ['parts.tsx', 'deco.tsx', 'szocreal.tsx', 'csillampony.tsx', 'ukiyoe.tsx']) {
      const src = fs.readFileSync(path.join(dir, file), 'utf8');
      expect(src).not.toMatch(/react-native-svg|expo-image|expo-linear-gradient|lottie/);
    }
  });
});
