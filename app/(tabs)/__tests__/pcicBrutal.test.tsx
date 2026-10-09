// The Learn tab on the brutalist palette (BrutalBox card, level box, docked
// button, segmented progress), and today's look on the classic palette. Mock pattern:
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

// One fixed item, so the test does not depend on the real PCIC corpus.
// The id has a "b1-" prefix because lib/pcicLevels.ts decides the
// level filter from the id prefix (the tab starts at the B1 base level).
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

describe('Learn tab, neo-brutalist', () => {
  beforeEach(async () => {
    await getDb().resetPcicCards();
  });

  it('with the brand palette a BrutalBox card, level box, docked button and segmented bar appear', async () => {
    await getDb().setGrammarPalette('brand');
    const view = render(<ThemeProvider><PcicScreen /></ThemeProvider>);
    await flush();
    expect(view.queryByTestId('learn-card')).toBeTruthy();
    expect(view.queryByTestId('learn-level-chip')).toBeTruthy();
    expect(view.queryByTestId('learn-docked-action')).toBeTruthy();
    expect(view.queryByTestId('learn-progress')).toBeTruthy();
    view.unmount();
  });

  // The "Didn't know" / "Knew it" buttons are identical: same
  // shadow offset (the margin of the outer wrapper), the box fills the row (flex: 1),
  // the label is centered, and the row spans the full width of the card.
  it('with the brand palette the two rating buttons are identical: same offset, fill box, centered label', async () => {
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

  it('with the classic palette the current look stays: no BrutalBox', async () => {
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
