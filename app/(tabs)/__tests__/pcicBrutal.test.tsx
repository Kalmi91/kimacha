// a Tanulás fül brutalista palettán (BrutalBox kártya, szint-doboz, dokkolt
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
    useEffect(cb, []);
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
}));

// Egy fix tétel, hogy a teszt ne a valódi PCIC-korpusztól függjön.
// Az id "b1-" előtaggal, mert lib/pcicLevels.ts a
// szint-szűrést az id-előtagból dönti el (a fül a B1 alap-szinten indul).
const FIXTURE_ITEM = { id: 'b1-x1', es: 'vida', en: 'life', kind: 'word' as const, section: 'Test', order: 0 };
jest.mock('@/data/pcic', () => ({
  PCIC_LEVELS: ['B1'],
  PCIC_VIEW_LEVELS: ['B1'],
  pcicItemsForLevel: () => [FIXTURE_ITEM],
  findPcicItem: (id: string) => (id === 'b1-x1' ? FIXTURE_ITEM : undefined),
  setPcicTarget: () => {},
}));

import { StyleSheet } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

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

  // a "Didn't know" / "Knew it" gomb egyforma: azonos
  // árnyék-eltolás (a külső burkoló margója), a doboz kitölti a sort (flex: 1),
  // a felirat középre igazított, és a sor a kártya teljes szélességén fut.
  it('brand palettán a két értékelő gomb egyforma: azonos eltolás, kitöltő doboz, középre igazított felirat', async () => {
    await getDb().setGrammarPalette('brand');
    const view = render(<ThemeProvider><PcicScreen /></ThemeProvider>);
    await flush();
    fireEvent.press(view.getByText('✓ Check'));
    await flush();

    const outerOf = (testID: string) => {
      let node = view.getByTestId(testID).parent;
      while (node && StyleSheet.flatten(node.props.style)?.marginRight === undefined) node = node.parent;
      return StyleSheet.flatten(node!.props.style);
    };
    const good = StyleSheet.flatten(view.getByTestId('pcic-grade-good').props.style);
    const again = StyleSheet.flatten(view.getByTestId('pcic-grade-again').props.style);
    expect(good.flex).toBe(1);
    expect(again.flex).toBe(1);
    expect(outerOf('pcic-grade-good').marginRight).toBe(outerOf('pcic-grade-again').marginRight);
    expect(outerOf('pcic-grade-good').marginBottom).toBe(outerOf('pcic-grade-again').marginBottom);
    expect(StyleSheet.flatten(view.getByText("Didn't know").props.style).textAlign).toBe('center');
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
