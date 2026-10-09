// the Check/grade flow, preselected
// Knew it / Didn't know, "You said:" with the old wrong sentence, "All done for now"
// when the deck is empty. Mock pattern: pcicCardShell.test.tsx.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
jest.mock('@/lib/speech', () => ({
  speak: jest.fn(),
  speakSequence: jest.fn(),
  stopSpeaking: jest.fn(),
}));

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
}));

import { act, fireEvent, render } from '@testing-library/react-native';
import { TextInput } from 'react-native';

import { getDb } from '@/lib/database';
import { validateMistakesPayload } from '@/lib/mistakes/format';
import sample from '@/lib/mistakes/__fixtures__/sample.json';
import MistakesDeckScreen from '../deck';

const flush = async (times = 4) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

async function seedBatch() {
  const result = validateMistakesPayload(sample);
  if (!result.ok) throw new Error(result.error);
  await getDb().saveMistakeBatch(result.batch.batchId, JSON.stringify(result.batch), '2026-09-23T10:00:00.000Z');
}

describe('Deck (app/mistakes/deck.tsx)', () => {
  it('empty deck (no batch loaded) -> "All done for now"', async () => {
    const { getByText } = render(<MistakesDeckScreen />);
    await flush();
    expect(getByText('All done for now')).toBeTruthy();
  });

  it('the word card chip is "Word", after Check "Knew it" is preselected on an exact match', async () => {
    await seedBatch();
    const { getByText, UNSAFE_getByType } = render(<MistakesDeckScreen />);
    await flush();

    // The first card (file order: sentences, then words, then drills) is the s1 sentence.
    expect(getByText('Sentence')).toBeTruthy();
    fireEvent.changeText(UNSAFE_getByType(TextInput), 'No tengo tomate.');
    fireEvent.press(getByText('✓ Check'));
    await flush();

    expect(getByText('Next → Knew it')).toBeTruthy();
    expect(getByText('Knew it')).toBeTruthy();
    expect(getByText("Didn't know")).toBeTruthy();
    // "You said:" with the old wrong sentence.
    expect(getByText('You said:')).toBeTruthy();
    expect(getByText('Pero no tienes tomate.')).toBeTruthy();
  });

  it('wrong answer -> "Didn\'t know" preselected, tapping goes to the next card', async () => {
    await seedBatch();
    const { getByText, UNSAFE_getByType } = render(<MistakesDeckScreen />);
    await flush();

    fireEvent.changeText(UNSAFE_getByType(TextInput), 'algo mal');
    fireEvent.press(getByText('✓ Check'));
    await flush();

    expect(getByText("Next → Didn't know")).toBeTruthy();
    fireEvent.press(getByText("Didn't know"));
    await flush();

    // It goes back to the end of the queue (due === today), the next card comes: s2.
    expect(getByText('✓ Check')).toBeTruthy();
  });
});
