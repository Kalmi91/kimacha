// The Beta section of Settings (every switch, EN + ES) and the three beta tabs of the tab bar (Practice, Sentences, Speak: hidden
// while their switch is off, the existing tabs unchanged). Mock pattern: a11yLabels.test.tsx.

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
import { Platform } from 'react-native';

import { clearSession, saveSession } from '@/lib/cloud/session';
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

describe('tab bar: the three beta tabs', () => {
  it('all are hidden while their switch is off, the existing tabs stay shown and in order', async () => {
    const view = render(<ThemeProvider><TabLayout /></ThemeProvider>);
    await flush();
    expect(tabLine(view, 'practice')).toBe('practice|Practice|hidden');
    expect(tabLine(view, 'sentences')).toBe('sentences|Sentences|hidden');
    expect(tabLine(view, 'speak')).toBe('speak|Speak|hidden');
    for (const name of ['index', 'course', 'board', 'stats', 'settings']) expect(tabLine(view, name)).toMatch(/\|shown$/);
    const order = view.getAllByTestId(/^tab-/).map((n) => String(n.props.children).split('|')[0]);
    expect(order.filter((n) => n !== 'practice' && n !== 'sentences' && n !== 'speak')).toEqual(['index', 'course', 'board', 'stats', 'settings']);
    // Grammar, Sentences, Speak, Practice, Stats: Practice comes after the tabs that teach (Kálmán, 2026-11-04)
    expect(order.indexOf('sentences')).toBe(order.indexOf('course') + 1);
    expect(order.indexOf('speak')).toBe(order.indexOf('sentences') + 1);
    expect(order.indexOf('practice')).toBe(order.indexOf('speak') + 1);
    // the weekly leaderboard tab sits right before Stats
    expect(order.indexOf('board')).toBe(order.indexOf('practice') + 1);
    expect(order.indexOf('stats')).toBe(order.indexOf('board') + 1);
    view.unmount();
  });

  it('the Speak tab shows up when its own switch is on, and hides again when it goes off', async () => {
    const view = render(<ThemeProvider><TabLayout /></ThemeProvider>);
    await flush();
    await act(async () => { await setBeta('speechTab', true); });
    expect(tabLine(view, 'speak')).toBe('speak|Speak|shown');
    expect(tabLine(view, 'practice')).toMatch(/\|hidden$/);
    expect(tabLine(view, 'sentences')).toMatch(/\|hidden$/);
    await act(async () => { await setBeta('speechTab', false); });
    expect(tabLine(view, 'speak')).toMatch(/\|hidden$/);
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
    expect(tabLine(view, 'speak')).toBe('speak|Hablar|hidden');
    view.unmount();
  });
});

describe('tab bar: the weekly leaderboard tab', () => {
  it('is shown on native with its title', async () => {
    const view = render(<ThemeProvider><TabLayout /></ThemeProvider>);
    await flush();
    expect(tabLine(view, 'board')).toBe('board|Weekly leaderboard|shown');
    view.unmount();
  });

  it('is hidden for a guest on web (no cloud session) and shown with one', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    Object.defineProperty(globalThis, 'location', { configurable: true, value: { search: '' } });
    const guest = render(<ThemeProvider><TabLayout /></ThemeProvider>);
    await flush();
    expect(tabLine(guest, 'board')).toBe('board|Weekly leaderboard|hidden');
    guest.unmount();

    const store = new Map([['kimacha.cloud.session', JSON.stringify({ name: 'Kálmán', token: 'web-tok' })]]);
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k: string) => store.get(k) ?? null, setItem: () => {}, removeItem: () => {} } });
    const member = render(<ThemeProvider><TabLayout /></ThemeProvider>);
    await flush();
    expect(tabLine(member, 'board')).toBe('board|Weekly leaderboard|shown');
    member.unmount();
    delete (globalThis as { localStorage?: unknown }).localStorage;
    delete (globalThis as { location?: unknown }).location;
    jest.restoreAllMocks();
  });
});

describe('tab bar: the leaderboard tab follows login and logout on web', () => {
  it('a guest who logs in gets the tab, a logout hides it again', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    Object.defineProperty(globalThis, 'location', { configurable: true, value: { search: '' } });
    const store = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) },
    });
    const view = render(<ThemeProvider><TabLayout /></ThemeProvider>);
    await flush();
    expect(tabLine(view, 'board')).toMatch(/\|hidden$/);
    await act(async () => { saveSession({ name: 'Kálmán', token: 'web-tok' }); });
    expect(tabLine(view, 'board')).toMatch(/\|shown$/);
    await act(async () => { clearSession(); });
    expect(tabLine(view, 'board')).toMatch(/\|hidden$/);
    view.unmount();
    delete (globalThis as { localStorage?: unknown }).localStorage;
    delete (globalThis as { location?: unknown }).location;
    jest.restoreAllMocks();
  });
});

describe('Settings: Beta section', () => {
  const EN = { practiceTab: 'Practice tab', sentenceTab: 'Sentences tab', xpV2: 'New XP values', levels: 'Levels A1-C1', practiceDictation: 'Dictation game', practiceScramble: 'Letter scramble game', practiceMatch: 'Quick match game', practiceOpposites: 'Opposites game', practiceSituations: 'Situations game', sentenceMistakes: 'Sentences: from my mistakes', sentenceHint: 'Sentences: tap-a-word hints', sentenceMix: 'Sentences: the sentences take turns', speechTab: 'Speak tab' } as const;
  const ES = { practiceTab: 'Pestaña Práctica', sentenceTab: 'Pestaña Frases', xpV2: 'Nuevos valores de XP', levels: 'Niveles A1-C1', practiceDictation: 'Juego de dictado', practiceScramble: 'Juego de letras revueltas', practiceMatch: 'Juego de parejas rápidas', practiceOpposites: 'Juego de opuestos', practiceSituations: 'Juego de situaciones', sentenceMistakes: 'Frases: de mis errores', sentenceHint: 'Frases: pistas al tocar una palabra', sentenceMix: 'Frases: las frases se alternan', speechTab: 'Pestaña Hablar' } as const;

  describe.each(['classic', 'brand'] as const)('palette %s', (palette) => {
    it('every switch is named and set off; a toggle saves the flag', async () => {
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
