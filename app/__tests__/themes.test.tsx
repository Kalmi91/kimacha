// The Themes screen (app/themes.tsx): the grid shows 24 themes + the My mix entry,
// by group in the spec's order; tapping saves immediately; a single-mode theme has no mode selector.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, navigate: jest.fn(), back: mockBack }),
}));

import { useEffect } from 'react';
import { act, fireEvent, render, within } from '@testing-library/react-native';
import * as RN from 'react-native';

import { SKIN_GROUPS } from '@/constants/Skins';
import { getDb } from '@/lib/database';
import { ThemeProvider, useTheme } from '@/lib/ThemeContext';
import ThemesScreen from '../themes';

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

const idsOf = (nodes: { props: { testID?: string } }[], prefix: string) =>
  nodes.map((n) => (n.props.testID as string).slice(prefix.length));

async function mount() {
  const view = render(
    <ThemeProvider>
      <Probe />
      <ThemesScreen />
    </ThemeProvider>,
  );
  await flush();
  return view;
}

describe('Themes screen', () => {
  let scheme: jest.SpyInstance;
  beforeEach(async () => {
    scheme = jest.spyOn(RN, 'useColorScheme').mockReturnValue('light');
    mockPush.mockClear();
    mockBack.mockClear();
    await getDb().setGrammarPalette('brand');
    await getDb().setSkin(null);
  });
  afterEach(() => scheme.mockRestore());

  it('24 themes + Custom mix entry, per group in spec order', async () => {
    const view = await mount();

    expect(view.getByTestId('themes-mix-entry')).toBeTruthy();
    expect(view.getByText('My mix')).toBeTruthy();

    const groups = view.getAllByTestId(/^themes-group-/);
    expect(idsOf(groups, 'themes-group-')).toEqual(SKIN_GROUPS.map((g) => g.id));
    for (const group of SKIN_GROUPS) {
      const tiles = within(view.getByTestId(`themes-group-${group.id}`)).getAllByTestId(/^theme-tile-/);
      expect(idsOf(tiles, 'theme-tile-')).toEqual(group.skins);
    }
    expect(view.getAllByTestId(/^theme-tile-/)).toHaveLength(24);

    // group and theme names from i18n
    expect(view.getByText('Recommended')).toBeTruthy();
    expect(view.getByText('Ukiyo-e')).toBeTruthy();
    expect(view.getByText('Socialist realism')).toBeTruthy();
    view.unmount();
  });

  it('the Custom mix entry leads to the editor screen', async () => {
    const view = await mount();
    fireEvent.press(view.getByTestId('themes-mix-entry'));
    expect(mockPush).toHaveBeenCalledWith('/theme-mix');
    view.unmount();
  });

  it('tapping applies and saves the theme immediately; the active tile is selected', async () => {
    const view = await mount();
    expect(ctx.skin).toBe('brutal');
    expect(view.getByTestId('theme-tile-brutal').props.accessibilityState).toMatchObject({ selected: true });

    fireEvent.press(view.getByTestId('theme-tile-deco'));
    await flush();
    expect(ctx.skin).toBe('deco');
    expect(await getDb().getSkin()).toBe('deco');
    expect(view.getByTestId('theme-tile-deco').props.accessibilityState).toMatchObject({ selected: true });
    expect(view.getByTestId('theme-tile-brutal').props.accessibilityState).toMatchObject({ selected: false });
    view.unmount();
  });

  it('a dual-mode theme has an Auto / Light / Dark chooser, a single-mode one has one row in its place', async () => {
    const view = await mount();
    expect(view.queryByTestId('themes-mode')).toBeTruthy();
    expect(view.queryByTestId('themes-one-look')).toBeNull();

    fireEvent.press(view.getByTestId('theme-tile-szocreal'));
    await flush();
    expect(view.queryByTestId('themes-mode')).toBeNull();
    expect(view.getByTestId('themes-one-look')).toBeTruthy();
    expect(view.getByText('This theme has one look.')).toBeTruthy();

    fireEvent.press(view.getByTestId('theme-tile-ukiyoe'));
    await flush();
    expect(view.queryByTestId('themes-mode')).toBeTruthy();
    expect(view.queryByTestId('themes-one-look')).toBeNull();

    fireEvent.press(view.getByTestId('themes-mode-dark'));
    await flush();
    expect(ctx.override).toBe('dark');
    expect(ctx.theme).toBe('ukiyoe-dark');
    view.unmount();
  });

  it('the mode button icon is above the label, the label is a single line', async () => {
    const view = await mount();
    for (const [value, label] of [['system', 'Auto'], ['light', 'Light'], ['dark', 'Dark']] as const) {
      const button = view.getByTestId(`themes-mode-${value}`);
      const text = within(button).getByText(label);
      expect(text.props.numberOfLines).toBe(1);
      expect(text.props.adjustsFontSizeToFit).toBe(true);
      expect(text.props.minimumFontScale).toBe(0.8);
    }
    view.unmount();
  });

  it('the 5 sub-palettes show only under Neo-brutalist', async () => {
    const view = await mount();
    for (const id of ['brand', 'electric', 'lime', 'cyan', 'orange']) {
      expect(view.getByTestId(`palette-${id}`)).toBeTruthy();
    }
    fireEvent.press(view.getByTestId('theme-tile-deco'));
    await flush();
    expect(view.queryByTestId('themes-palettes')).toBeNull();
    expect(view.queryByTestId('palette-cyan')).toBeNull();
    view.unmount();
  });
});
