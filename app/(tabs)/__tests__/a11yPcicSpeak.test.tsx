// Accessibility: after Check, the 🔊 next to the revealed answer on the Learn tab is a button
// named "Play audio" (EN) / "Reproducir audio" (ES). Mock pattern: pcicSpeak.test.tsx.

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
import { setLanguage } from '@/lib/i18n';
import { speak } from '@/lib/speech';
import PcicScreen from '../index';

const mockSpeak = speak as jest.Mock;

const flush = async (times = 4) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('a11y: Learn tab revealed answer', () => {
  beforeEach(async () => {
    await getDb().resetPcicCards();
    mockSpeak.mockClear();
  });
  afterEach(() => setLanguage('en'));

  it('the 🔊 after Check is a button named "Play audio" and speaks the answer again', async () => {
    const view = render(<PcicScreen />);
    await flush();
    fireEvent.changeText(view.UNSAFE_getByType(TextInput), 'vida');
    fireEvent.press(view.getByText('✓ Check'));
    await flush();

    // two 🔊: the English prompt and the revealed Spanish answer (the last one).
    const speakBtns = view.getAllByLabelText('Play audio');
    expect(speakBtns.length).toBeGreaterThanOrEqual(2);
    for (const b of speakBtns) expect(b.props.accessibilityRole).toBe('button');
    mockSpeak.mockClear(); // the answer is also read out automatically on reveal
    fireEvent.press(speakBtns[speakBtns.length - 1]);
    expect(mockSpeak).toHaveBeenCalledWith('vida', 'es-MX');
  });
});
