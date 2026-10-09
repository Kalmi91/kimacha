// a Saját mix képernyő (app/theme-mix.tsx): négy chip-sor, élő előnézet a
// piszkozattal, a mentés (setSkinMix + setSkin('mix')) és a visszatöltés.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), back: mockBack }),
}));

import { useEffect } from 'react';
import { act, fireEvent, render, within } from '@testing-library/react-native';
import * as RN from 'react-native';

import { COLOR_CHOICES, SKIN_ORDER, decorChoices, uniqueShapeChoices } from '@/components/skins/mixChoices';
import { DEFAULT_SKIN_MIX, SKINS } from '@/constants/Skins';
import { getDb } from '@/lib/database';
import { ThemeProvider, useTheme } from '@/lib/ThemeContext';
import ThemeMixScreen from '../theme-mix';

jest.setTimeout(30000);

let ctx: ReturnType<typeof useTheme>;
function Probe() {
  const value = useTheme();
  useEffect(() => {
    ctx = value;
  });
  return null;
}

const flush = async () => {
  for (let i = 0; i < 6; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

async function mount() {
  const view = render(
    <ThemeProvider>
      <Probe />
      <ThemeMixScreen />
    </ThemeProvider>,
  );
  await flush();
  return view;
}

const flat = (style: unknown) => RN.StyleSheet.flatten(style as RN.StyleProp<RN.ViewStyle & RN.TextStyle>);

describe('Saját mix képernyő (PLAN-temak 4D)', () => {
  let scheme: jest.SpyInstance;
  beforeEach(async () => {
    scheme = jest.spyOn(RN, 'useColorScheme').mockReturnValue('light');
    mockBack.mockClear();
    await getDb().setGrammarPalette('brand');
    await getDb().setSkin(null);
    await getDb().setSkinMix(DEFAULT_SKIN_MIX);
  });
  afterEach(() => scheme.mockRestore());

  it('négy szekció; a Colors-ban a régi 4 al-paletta is, a Shape-ben összevont formák, a Decor-ban None + a díszes témák', async () => {
    const view = await mount();
    for (const section of ['colors', 'font', 'shape', 'decor']) {
      expect(view.getByTestId(`mix-section-${section}`)).toBeTruthy();
    }

    const colors = within(view.getByTestId('mix-section-colors')).getAllByTestId(/^mix-colors-[a-z0-9]+$/);
    expect(colors).toHaveLength(COLOR_CHOICES.length);
    for (const id of ['electric', 'lime', 'cyan', 'orange', 'ukiyoe', 'classic']) {
      expect(view.getByTestId(`mix-colors-${id}`)).toBeTruthy();
    }

    expect(within(view.getByTestId('mix-section-font')).getAllByTestId(/^mix-font-[a-z0-9]+$/)).toHaveLength(SKIN_ORDER.length);

    const shapes = within(view.getByTestId('mix-section-shape')).getAllByTestId(/^mix-shape-[a-z0-9]+$/);
    expect(shapes).toHaveLength(uniqueShapeChoices().length);
    expect(shapes.length).toBeLessThan(SKIN_ORDER.length);
    const keys = uniqueShapeChoices().map((id) => JSON.stringify(SKINS[id].shape));
    expect(new Set(keys).size).toBe(keys.length);

    const decors = within(view.getByTestId('mix-section-decor')).getAllByTestId(/^mix-decor-[a-z0-9]+$/);
    expect(decors).toHaveLength(decorChoices().length);
    expect(view.getByTestId('mix-decor-none')).toBeTruthy();
    for (const id of ['deco', 'szocreal', 'csillampony', 'ukiyoe']) {
      expect(view.getByTestId(`mix-decor-${id}`)).toBeTruthy();
    }
    expect(view.queryByTestId('mix-decor-brutal')).toBeNull();
    view.unmount();
  });

  it('az élő előnézet a piszkozat színét, betűjét és díszét rajzolja', async () => {
    const view = await mount();
    expect(view.getByText('el carro')).toBeTruthy();
    expect(view.queryByTestId('decor-csillampony-rainbow')).toBeNull();

    fireEvent.press(view.getByTestId('mix-colors-plakat'));
    fireEvent.press(view.getByTestId('mix-font-senior'));
    fireEvent.press(view.getByTestId('mix-decor-csillampony'));
    await flush();

    expect(flat(view.getByTestId('mix-preview').props.style).backgroundColor).toBe(SKINS.plakat.colors.light?.bg);
    expect(flat(view.getByTestId('mix-preview-word').props.style).fontFamily).toBe('Atkinson-Bold');
    expect(view.getByTestId('decor-csillampony-rainbow')).toBeTruthy();

    fireEvent.press(view.getByTestId('mix-decor-none'));
    await flush();
    expect(view.queryByTestId('decor-csillampony-rainbow')).toBeNull();
    // a képernyő maga nem változott: a mentés előtt az aktív téma ugyanaz
    expect(ctx.skin).toBe('brutal');
    view.unmount();
  });

  it('a mix mentése (setSkinMix + setSkin) és visszatöltése', async () => {
    const shapeId = uniqueShapeChoices()[2];
    const view = await mount();
    fireEvent.press(view.getByTestId('mix-colors-ukiyoe'));
    fireEvent.press(view.getByTestId('mix-font-zen'));
    fireEvent.press(view.getByTestId(`mix-shape-${shapeId}`));
    fireEvent.press(view.getByTestId('mix-decor-deco'));
    expect(view.getByTestId('mix-colors-ukiyoe-selected')).toBeTruthy();
    fireEvent.press(view.getByTestId('mix-save'));
    await flush();

    const mix = { colors: 'ukiyoe', font: 'zen', shape: shapeId, decor: 'deco' };
    expect(mockBack).toHaveBeenCalled();
    expect(ctx.skin).toBe('mix');
    expect(ctx.skinMix).toEqual(mix);
    expect(await getDb().getSkin()).toBe('mix');
    expect(await getDb().getSkinMix()).toEqual(mix);
    view.unmount();

    // újranyitva a mentett mix van kijelölve
    const again = await mount();
    expect(ctx.skin).toBe('mix');
    expect(again.getByTestId('mix-colors-ukiyoe-selected')).toBeTruthy();
    expect(again.getByTestId('mix-font-zen-selected')).toBeTruthy();
    expect(again.getByTestId(`mix-shape-${shapeId}-selected`)).toBeTruthy();
    expect(again.getByTestId('mix-decor-deco-selected')).toBeTruthy();
    expect(again.queryByTestId('mix-colors-brutal-selected')).toBeNull();
    again.unmount();
  });
});
