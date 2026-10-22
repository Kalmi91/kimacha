// The Beta section of Settings (four switches, EN + ES, all off by default) and the two beta tabs of the
// tab bar (hidden while their switch is off, the existing tabs unchanged). Mock pattern: a11yLabels.test.tsx.

jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('expo-router', () => {
  const React = require('react');
  const { Text } = require('react-native');
  // Tabs mock: one line per Tabs.Screen, "<name>|<title>|hidden or shown" (href null = hidden).
  const Tabs = ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      React.Fragment,
      null,
      React.Children.map(children, (c: React.ReactElement<any>) =>
        React.createElement(
          Text,
          { testID: `tab-${c.props.name}` },
          `${c.props.name}|${c.props.options.title}|${c.props.options.href === null ? 'hidden' : 'shown'}`
        )
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
import { BETA_FLAGS, __resetBetaForTest, getBeta, setBeta } from '@/lib/beta';
import { setLanguage } from '@/lib/i18n';
import { ThemeProvider } from '@/lib/ThemeContext';
import TabLayout from '../_layout';
import SettingsScreen from '../settings';
import { makeFlush } from '@/test-utils/flush';

jest.setTimeout(30000);

const flush = makeFlush(6);

beforeEach(async () => {
  __resetBetaForTest();
  for (const f of BETA_FLAGS) await getDb().setBetaFlag(f, false);
});
afterEach(() => setLanguage('en'));

const tabLine = (view: ReturnType<typeof render>, name: string) => String(view.getByTestId(`tab-${name}`).props.children);

describe('tab bar: the two beta tabs', () => {
  it('both are hidden by default, the existing tabs stay shown and in order', async () => {
    const view = render(<ThemeProvider><TabLayout /></ThemeProvider>);
    await flush();
    expect(tabLine(view, 'practice')).toBe('practice|Practice|hidden');
    expect(tabLine(view, 'sentences')).toBe('sentences|Sentences|hidden');
    for (const name of ['index', 'course', 'stats', 'settings']) expect(tabLine(view, name)).toMatch(/\|shown$/);
    const order = view.getAllByTestId(/^tab-/).map((n) => String(n.props.children).split('|')[0]);
    expect(order.filter((n) => n !== 'practice' && n !== 'sentences')).toEqual(['index', 'course', 'stats', 'settings']);
    view.unmount();
  });

  it('each shows up when its own switch is on, and hides again when it goes off', async () => {
    const view = render(<ThemeProvider><TabLayout /></ThemeProvider>);
    await flush();
    await act(async () => { await setBeta('practiceTab', true); });
    expect(tabLine(view, 'practice')).toMatch(/\|shown$/);
    expect(tabLine(view, 'sentences')).toMatch(/\|hidden$/);
    await act(async () => { await setBeta('sentenceTab', true); });
    expect(tabLine(view, 'sentences')).toMatch(/\|shown$/);
    await act(async () => { await setBeta('practiceTab', false); });
    expect(tabLine(view, 'practice')).toMatch(/\|hidden$/);
    view.unmount();
  });

  it('Spanish titles', async () => {
    setLanguage('es');
    const view = render(<ThemeProvider><TabLayout /></ThemeProvider>);
    await flush();
    expect(tabLine(view, 'practice')).toBe('practice|Práctica|hidden');
    expect(tabLine(view, 'sentences')).toBe('sentences|Frases|hidden');
    view.unmount();
  });
});

describe('Settings: Beta section', () => {
  const EN = { practiceTab: 'Practice tab', sentenceTab: 'Sentences tab', xpV2: 'New XP values', levels: 'Levels A1-C1', practiceDictation: 'Dictation game', practiceScramble: 'Letter scramble game', practiceMatch: 'Quick match game' } as const;
  const ES = { practiceTab: 'Pestaña Práctica', sentenceTab: 'Pestaña Frases', xpV2: 'Nuevos valores de XP', levels: 'Niveles A1-C1', practiceDictation: 'Juego de dictado', practiceScramble: 'Juego de letras revueltas', practiceMatch: 'Juego de parejas rápidas' } as const;

  describe.each(['classic', 'brand'] as const)('palette %s', (palette) => {
    it('seven named switches, all off; a toggle saves the flag', async () => {
      await getDb().setGrammarPalette(palette);
      const view = render(<ThemeProvider><SettingsScreen /></ThemeProvider>);
      await flush();
      expect(view.getByText('Beta')).toBeTruthy();
      for (const flag of BETA_FLAGS) {
        const sw = view.getByLabelText(EN[flag]);
        expect(sw.props.testID).toBe(`settings-beta-${flag}`);
        if (palette === 'brand') {
          expect(sw.props.accessibilityRole).toBe('switch');
          expect(sw.props.accessibilityState.checked).toBe(false);
        } else {
          expect(sw.props.value).toBe(false);
        }
        expect(getBeta(flag)).toBe(false);
      }
      const sw = view.getByLabelText(EN.xpV2);
      if (palette === 'brand') fireEvent.press(sw);
      else fireEvent(sw, 'valueChange', true);
      await flush();
      expect(getBeta('xpV2')).toBe(true);
      expect(await getDb().getBetaFlags()).toMatchObject({ xpV2: true });
      expect(getBeta('levels')).toBe(false);
      const after = view.getByLabelText(EN.xpV2);
      if (palette === 'brand') expect(after.props.accessibilityState.checked).toBe(true);
      else expect(after.props.value).toBe(true);
      view.unmount();
    });
  });

  it('Spanish UI: the switch labels are Spanish', async () => {
    await getDb().setGrammarPalette('classic');
    setLanguage('es');
    const view = render(<ThemeProvider><SettingsScreen /></ThemeProvider>);
    await flush();
    for (const flag of BETA_FLAGS) expect(view.getByLabelText(ES[flag]).props.testID).toBe(`settings-beta-${flag}`);
    view.unmount();
  });
});
