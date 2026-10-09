// The PCIC tab takes over the Learn card surface (CardShell,
// DockedAction). After the reveal the docked bar switches to "Next" (with the suggested
// rating in its label), and the old Knew it / Didn't know button row stays in the card
// for overriding. Mock pattern: pcicSpeak.test.tsx (db, router, speech, data/pcic).

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

// useDockLift (the PCIC docked bar) now calls useSafeAreaInsets, which
// throws without a SafeAreaProvider; its size does not matter here, it just must not throw.
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

import { act, fireEvent, render } from '@testing-library/react-native';
import { TextInput } from 'react-native';

import { getDb } from '@/lib/database';
import PcicScreen from '../index';

const flush = async (times = 4) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('PCIC tab: Learn card surface', () => {
  beforeEach(async () => {
    await getDb().resetPcicCards();
  });

  it('shows the Learn CardShell chip (new) and the docked Check button while typing', async () => {
    const { getByText } = render(<PcicScreen />);
    await flush();

    expect(getByText('new')).toBeTruthy();
    expect(getByText('✓ Check')).toBeTruthy();
  });

  it('after reveal the docked bar switches to "Next -> Knew it", the old buttons stay for override', async () => {
    const { getByText, queryByText, getAllByText, UNSAFE_getByType } = render(<PcicScreen />);
    await flush();

    fireEvent.changeText(UNSAFE_getByType(TextInput), 'vida');
    fireEvent.press(getByText('✓ Check'));
    await flush();

    expect(queryByText('✓ Check')).toBeNull();
    expect(getByText('Next → Knew it')).toBeTruthy();
    expect(getByText('Knew it')).toBeTruthy();
    expect(getByText("Didn't know")).toBeTruthy();
    // LEARNING_STEPS=1: "Didn't know" (again) stays due today (<1 day), but
    // "Knew it" (good) graduates in one step, interval 1 day.
    expect(getAllByText('<1 day').length).toBe(1);
    expect(getByText('1 day')).toBeTruthy();
  });

  it('an empty submit also reveals the correct form, suggests "Next -> Didn\'t know", the tap decides', async () => {
    const { getByText, getAllByText } = render(<PcicScreen />);
    await flush();

    fireEvent.press(getByText('✓ Check'));
    await flush();

    expect(getByText("Next → Didn't know")).toBeTruthy();
    expect(getAllByText('vida').length).toBeGreaterThan(0);
    expect(getByText('Knew it')).toBeTruthy();
    expect(getByText("Didn't know")).toBeTruthy();

    fireEvent.press(getByText("Didn't know"));
    await flush();

    expect(getByText('✓ Check')).toBeTruthy();
  });
});
