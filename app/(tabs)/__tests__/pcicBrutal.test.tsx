// NY19: a Tanulás fül brutalista palettán (BrutalBox kártya, szint-doboz, dokkolt
// gomb, szegmentált progress), classic palettán a mai kinézet. Mock-minta:
// pcicCardShell.test.tsx.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
jest.mock('@/lib/speech', () => ({
  speak: jest.fn(),
  speakSequence: jest.fn(),
  stopSpeaking: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(cb, []);
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
}));

// Egy fix tétel, hogy a teszt ne a valódi PCIC-korpusztól függjön.
// PLAN-play 10. lépés: az id "b1-" előtaggal, mert lib/pcicLevels.ts a
// szint-szűrést az id-előtagból dönti el (a fül a B1 alap-szinten indul).
const FIXTURE_ITEM = { id: 'b1-x1', es: 'vida', en: 'life', kind: 'word' as const, section: 'Test', order: 0 };
jest.mock('@/data/pcic', () => ({
  PCIC_LEVELS: ['B1'],
  PCIC_VIEW_LEVELS: ['B1'],
  LEVEL_LABELS: { B1: 'Intermediate' },
  pcicItemsForLevel: () => [FIXTURE_ITEM],
  pcicItemsForViewLevel: () => [FIXTURE_ITEM],
  findPcicItem: (id: string) => (id === 'b1-x1' ? FIXTURE_ITEM : undefined),
  isPlusSentence: () => false,
  realLevelOfView: (level: string) => level,
  setPcicTarget: () => {},
}));

import { act, render } from '@testing-library/react-native';

import { getDb } from '@/lib/database';
import { ThemeProvider } from '@/lib/ThemeContext';
import PcicScreen from '../index';

const flush = async (times = 6) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

jest.setTimeout(30000);

describe('Tanulás fül, neo-brutalista (NY19)', () => {
  beforeEach(async () => {
    await getDb().resetPcicCards();
  });

  it('brand palettán BrutalBox kártya, szint-doboz, dokkolt gomb és szegmentált sáv jelenik meg', async () => {
    await getDb().setGrammarPalette('brand');
    const view = render(<ThemeProvider><PcicScreen /></ThemeProvider>);
    await flush();
    expect(view.queryByTestId('learn-card')).toBeTruthy();
    expect(view.queryByTestId('learn-level-chip')).toBeTruthy();
    expect(view.queryByTestId('learn-docked-action')).toBeTruthy();
    expect(view.queryByTestId('learn-progress')).toBeTruthy();
    view.unmount();
  });

  it('classic palettán a mai kinézet: nincs BrutalBox', async () => {
    await getDb().setGrammarPalette('classic');
    const view = render(<ThemeProvider><PcicScreen /></ThemeProvider>);
    await flush();
    expect(view.queryByText('✓ Check')).toBeTruthy();
    expect(view.queryByTestId('learn-card')).toBeNull();
    expect(view.queryByTestId('learn-level-chip')).toBeNull();
    expect(view.queryByTestId('learn-docked-action')).toBeNull();
    view.unmount();
  });
});
