import type { ComponentProps, ReactElement, ReactNode } from 'react';
import { render, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { DefaultTheme, HeaderTitle, ThemeProvider as NavigationThemeProvider } from 'expo-router/react-navigation';

import TabLayout from '../_layout';
import { BetaSticker } from '@/components/BetaSticker';
import { SKIN_DECOR } from '@/components/skins';
import { Sticker } from '@/components/grammar/Brutal';
import Colors from '@/constants/Colors';
import { SKINS, type SkinId, type SkinMode } from '@/constants/Skins';
import { brutalHeaderOptions } from '@/lib/brutalHeader';
import { grammarColorsFor } from '@/lib/grammarColors';
import { setLanguage, t } from '@/lib/i18n';
import { themeKeyFor } from '@/lib/skinTheme';
import type { ThemeKey } from '@/lib/ThemeContext';

let mockSkin: SkinId = 'classic';
let mockTheme: ThemeKey = 'light';
let mockStatsTitle: string | undefined;

jest.mock('@/lib/ThemeContext', () => ({
  useTheme: () => ({ theme: mockTheme, skin: mockSkin, grammarPalette: mockSkin === 'classic' ? 'classic' : 'brand' }),
}));
jest.mock('@/lib/cloud/useHasSession', () => ({ useHasSession: () => true }));
jest.mock('@/lib/webKeyboard', () => ({ useWebKeyboardOpen: () => false }));
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('expo-router', () => {
  const React = require('react');
  const { View } = require('react-native');
  const { NavigationRouteContext } = require('expo-router/react-navigation');
  type MockOptions = {
    title: string;
    headerShown?: boolean;
    headerTintColor?: string;
    headerTitleStyle?: ComponentProps<typeof HeaderTitle>['style'];
    headerTitle: (props: ComponentProps<typeof HeaderTitle>) => ReactNode;
  };
  const Tabs = ({ screenOptions, children }: { screenOptions: MockOptions; children: ReactNode }) =>
    React.createElement(View, null, React.Children.map(children, (child: ReactElement<{ name: string; options: MockOptions }>) => {
      const { name } = child.props;
      const options = { ...screenOptions, ...child.props.options };
      return options.headerShown === false ? null : React.createElement(
        NavigationRouteContext.Provider,
        { value: { key: name, name } },
        React.createElement(View, { testID: `header-${name}` }, options.headerTitle({
          children: name === 'stats' && mockStatsTitle ? mockStatsTitle : options.title,
          tintColor: options.headerTintColor,
          style: options.headerTitleStyle,
        })),
      );
    }));
  Tabs.Screen = function Screen() { return null; };
  return { Tabs };
});

function selectSkin(skin: SkinId, mode: SkinMode = 'light') {
  mockSkin = skin;
  mockTheme = themeKeyFor(skin, mode, 'brand');
}

function renderTabs() {
  return render(<NavigationThemeProvider value={DefaultTheme}><TabLayout /></NavigationThemeProvider>);
}

beforeEach(() => {
  selectSkin('classic');
  setLanguage('en');
  mockStatsTitle = undefined;
});
afterEach(() => setLanguage('en'));

const skins = Object.keys(SKINS) as SkinId[];
const skinModes = skins.flatMap((id) => SKINS[id].modes.map((mode) => [id, mode] as const));
const betaTabs = ['sentences', 'speak', 'practice'] as const;

describe('beta tab headers', () => {
  it.each(skinModes)('%s %s labels exactly the three unfinished tabs', (skin, mode) => {
    selectSkin(skin, mode);
    const view = renderTabs();
    expect(view.getAllByTestId(/^beta-sticker-/)).toHaveLength(3);
    expect(view.getAllByLabelText('Beta: not finished yet')).toHaveLength(3);
    for (const tab of betaTabs) {
      const header = within(view.getByTestId(`header-${tab}`));
      expect(header.getByTestId(`beta-sticker-${tab}`)).toBeTruthy();
      expect(header.getByText(t().tabs[tab])).toBeTruthy();
    }
    for (const tab of ['index', 'course', 'board', 'stats', 'settings']) {
      expect(view.queryByTestId(`beta-sticker-${tab}`)).toBeNull();
      const header = view.queryByTestId(`header-${tab}`);
      if (header) expect(within(header).queryByLabelText(t().a11y.beta)).toBeNull();
    }
    expect(view.queryByTestId('header-index')).toBeNull();
    expect(Boolean(view.queryByTestId('header-course'))).toBe(skin === 'classic');
  });

  it.each([
    ['en', 'Beta', 'Beta: not finished yet'],
    ['hu', 'Béta', 'Béta: még nincs kész'],
    ['de', 'Beta', 'Beta: noch nicht fertig'],
    ['es', 'Beta', 'Beta: todavía no está terminado'],
  ])('%s translates the badge and its screen-reader explanation', (language, label, explanation) => {
    setLanguage(language);
    const view = renderTabs();
    expect(view.getAllByLabelText(explanation)).toHaveLength(3);
    for (const tab of betaTabs) {
      const sticker = view.getByTestId(`beta-sticker-${tab}`);
      expect(sticker.props.accessible).toBe(true);
      expect(sticker.props.accessibilityRole).toBe('text');
      expect(StyleSheet.flatten(within(sticker).getByText(label).props.style).textTransform).toBe('uppercase');
      expect(within(view.getByTestId(`header-${tab}`)).getByText(t().tabs[tab])).toBeTruthy();
    }
  });

  it.each(skins.filter((id) => !SKIN_DECOR[id]?.HeaderOrnament))('%s preserves the native title styling', (skin) => {
    selectSkin(skin);
    const g = grammarColorsFor(mockTheme);
    const options = brutalHeaderOptions(g, SKINS[skin]);
    const view = render(
      <NavigationThemeProvider value={DefaultTheme}>
        <HeaderTitle testID="original-title" tintColor={options.headerTintColor ?? Colors[mockTheme].text} style={options.headerTitleStyle}>
          {t().tabs.sentences}
        </HeaderTitle>
        <TabLayout />
      </NavigationThemeProvider>,
    );
    const actual = within(view.getByTestId('header-sentences')).getByText(t().tabs.sentences);
    expect(StyleSheet.flatten(actual.props.style)).toEqual(StyleSheet.flatten(view.getByTestId('original-title').props.style));
    expect(actual.props.numberOfLines).toBe(1);
  });

  it('keeps the ornament around the title and the badge next to it', () => {
    selectSkin('deco');
    const view = renderTabs();
    for (const tab of betaTabs) {
      const header = within(view.getByTestId(`header-${tab}`));
      expect(header.getByTestId('decor-deco-divider')).toBeTruthy();
      expect(header.getByText(t().tabs[tab]).props.numberOfLines).toBe(1);
      expect(header.getByTestId(`beta-sticker-${tab}`)).toBeTruthy();
    }
    expect(within(view.getByTestId('header-stats')).getByTestId('decor-deco-divider')).toBeTruthy();
  });

  it('selects badges by route, even if a different header uses the same title', () => {
    mockStatsTitle = t().tabs.sentences;
    const view = renderTabs();
    const stats = within(view.getByTestId('header-stats'));
    expect(stats.getByText(t().tabs.sentences)).toBeTruthy();
    expect(stats.queryByTestId(/^beta-sticker-/)).toBeNull();
    expect(view.getByTestId('beta-sticker-sentences')).toBeTruthy();
  });
});

describe('reusable BetaSticker', () => {
  it.each(['light', 'dark'] as const)('uses classic theme contrast colors in %s mode', (mode) => {
    selectSkin('classic', mode);
    const g = grammarColorsFor(mockTheme);
    const view = render(<BetaSticker />);
    expect(view.getByLabelText(t().a11y.beta)).toBeTruthy();
    expect(StyleSheet.flatten(view.getByText(t().common.beta).props.style)).toMatchObject({ backgroundColor: g.a, color: g.onA });
  });

  it('uses the existing brutal Sticker', () => {
    selectSkin('brutal');
    const view = render(<BetaSticker testID="reusable-beta" />);
    expect(view.getByTestId('reusable-beta').props.accessibilityLabel).toBe(t().a11y.beta);
    expect(view.UNSAFE_getByType(Sticker).props.label).toBe(t().common.beta);
    expect(StyleSheet.flatten(view.getByText(t().common.beta).props.style).textTransform).toBe('uppercase');
  });
});
