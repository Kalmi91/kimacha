// Accessibility: the icon-only tab buttons, the Settings steppers (−/+), the switches and the
// settings rows carry a role and a localized label (EN + ES). Mock pattern: settingsBrutal.test.tsx,
// tabBarBrutal.test.tsx.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('expo-router', () => {
  const React = require('react');
  const { Text } = require('react-native');
  // Tabs mock: renders only the accessibility label each Tabs.Screen declares.
  const Tabs = ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      React.Fragment,
      null,
      React.Children.map(children, (c: React.ReactElement<any>) =>
        React.createElement(Text, { testID: `tab-a11y-${c.props.name}` }, c.props.options.tabBarAccessibilityLabel ?? '')
      )
    );
  Tabs.Screen = function Screen() {
    return null;
  };
  return {
    Tabs,
    useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), back: jest.fn() }),
    useFocusEffect: (cb: () => void) => {
      const { useEffect } = require('react');
      useEffect(cb, []);
    },
  };
});
jest.mock('expo-file-system', () => ({ File: jest.fn(), Paths: { cache: '' } }));
jest.mock('expo-sharing', () => ({}));
jest.mock('expo-document-picker', () => ({}));

import { act, fireEvent, render } from '@testing-library/react-native';

import { getDb } from '@/lib/database';
import { setLanguage } from '@/lib/i18n';
import { ThemeProvider } from '@/lib/ThemeContext';
import TabLayout from '../_layout';
import SettingsScreen from '../settings';

jest.setTimeout(30000);

const flush = async () => {
  for (let i = 0; i < 6; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('a11y: tab bar (the tab labels are hidden, so each tab needs its own name)', () => {
  afterEach(() => setLanguage('en'));

  it('every tab has an accessibility label', async () => {
    const view = render(<ThemeProvider><TabLayout /></ThemeProvider>);
    await flush();
    expect(view.getByTestId('tab-a11y-index').props.children).toBe('Learn');
    expect(view.getByTestId('tab-a11y-course').props.children).toBe('Grammar');
    expect(view.getByTestId('tab-a11y-stats').props.children).toBe('Stats');
    expect(view.getByTestId('tab-a11y-settings').props.children).toBe('Settings');
    view.unmount();
  });

  it('Spanish UI: the tab labels are Spanish', async () => {
    setLanguage('es');
    const view = render(<ThemeProvider><TabLayout /></ThemeProvider>);
    await flush();
    expect(view.getByTestId('tab-a11y-index').props.children).toBe('Aprender');
    expect(view.getByTestId('tab-a11y-settings').props.children).toBe('Ajustes');
    view.unmount();
  });
});

describe('a11y: Settings tab', () => {
  afterEach(() => setLanguage('en'));

  describe.each(['classic', 'brand'] as const)('palette %s', (palette) => {
    it('steppers: −/+ are buttons named after what they change, and they still work', async () => {
      await getDb().setGrammarPalette(palette);
      const view = render(<ThemeProvider><SettingsScreen /></ThemeProvider>);
      await flush();
      for (const what of ['weekly study goal', 'new words a day', 'missed word comes back after']) {
        expect(view.getByLabelText(`Increase ${what}`).props.accessibilityRole).toBe('button');
        expect(view.getByLabelText(`Decrease ${what}`).props.accessibilityRole).toBe('button');
      }
      const shown = () => String(view.getByText(/words \/ day/).props.children);
      const before = shown();
      fireEvent.press(view.getByLabelText('Increase new words a day'));
      await flush();
      expect(shown()).not.toBe(before);
      view.unmount();
    });

    it('switches are named by their setting and toggle', async () => {
      await getDb().setGrammarPalette(palette);
      const view = render(<ThemeProvider><SettingsScreen /></ThemeProvider>);
      await flush();
      for (const [label, testID] of [
        ['Accents count', 'settings-strict-accents'],
        ['Article buttons', 'settings-article-picker'],
      ] as const) {
        const sw = view.getByLabelText(label);
        expect(sw.props.testID).toBe(testID);
        if (palette === 'brand') expect(sw.props.accessibilityRole).toBe('switch');
      }
      view.unmount();
    });

    it('the settings rows are buttons', async () => {
      await getDb().setGrammarPalette(palette);
      const view = render(<ThemeProvider><SettingsScreen /></ThemeProvider>);
      await flush();
      expect(view.getByRole('button', { name: /Backup/ })).toBeTruthy();
      view.unmount();
    });
  });

  it('Spanish UI: stepper and switch labels are Spanish', async () => {
    await getDb().setGrammarPalette('classic');
    setLanguage('es');
    const view = render(<ThemeProvider><SettingsScreen /></ThemeProvider>);
    await flush();
    expect(view.getByLabelText('Aumentar objetivo semanal de estudio')).toBeTruthy();
    expect(view.getByLabelText('Disminuir palabras nuevas al día')).toBeTruthy();
    expect(view.getByLabelText('Los acentos cuentan')).toBeTruthy();
    view.unmount();
  });
});
