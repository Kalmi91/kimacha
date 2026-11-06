// Released tabs stay visible and Settings no longer offers feature switches.

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

import { act, render } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { clearSession, saveSession } from '@/lib/cloud/session';
import { getDb } from '@/lib/database';
import { setLanguage } from '@/lib/i18n';
import { ThemeProvider } from '@/lib/ThemeContext';
import TabLayout from '../_layout';
import SettingsScreen from '../settings';
import { makeFlush } from '@/test-utils/flush';

jest.setTimeout(30000);

const flush = makeFlush(6);

afterEach(() => setLanguage('en'));

const tabLine = (view: ReturnType<typeof render>, name: string) => String(view.getByTestId(`tab-${name}`).props.children);

describe('tab bar: released features', () => {
  it('all three tabs and the existing tabs are shown in order, ignoring old saved switches', async () => {
    const db = getDb();
    const backup = JSON.parse(JSON.stringify(await db.exportAll()));
    backup.tables.user_meta[0].beta_flags = JSON.stringify({ practiceTab: false, sentenceTab: false, speechTab: false });
    await db.importAll(backup);
    const view = render(<ThemeProvider><TabLayout /></ThemeProvider>);
    await flush();
    expect(tabLine(view, 'practice')).toBe('practice|Practice|shown');
    expect(tabLine(view, 'sentences')).toBe('sentences|Sentences|shown');
    expect(tabLine(view, 'speak')).toBe('speak|Speak|shown');
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

  it('Spanish titles', async () => {
    setLanguage('es');
    const view = render(<ThemeProvider><TabLayout /></ThemeProvider>);
    await flush();
    expect(tabLine(view, 'practice')).toBe('practice|Práctica|shown');
    expect(tabLine(view, 'sentences')).toBe('sentences|Frases|shown');
    expect(tabLine(view, 'speak')).toBe('speak|Hablar|shown');
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


describe.each(['classic', 'brand'] as const)('Settings palette %s', (palette) => {
  it.each(['en', 'es', 'hu', 'de'] as const)('has no Beta section or switches in %s', async (language) => {
    await getDb().setGrammarPalette(palette);
    setLanguage(language);
    const view = render(<ThemeProvider><SettingsScreen /></ThemeProvider>);
    await flush();
    expect(view.queryByTestId('settings-beta-title')).toBeNull();
    expect(view.queryAllByTestId(/^settings-beta-/)).toHaveLength(0);
    view.unmount();
  });
});
