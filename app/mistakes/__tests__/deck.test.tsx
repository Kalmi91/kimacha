// PLAN-hibaim.md 4. lépés ("Pakli"): a Check/grade menet, előre kijelölt
// Knew it / Didn't know, "You said:" a régi hibás mondattal, üres pakli
// esetén "All done for now". Mock-minta: pcicCardShell.test.tsx.

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

describe('Pakli (app/mistakes/deck.tsx)', () => {
  it('üres pakli (nincs betöltött köteg) -> "All done for now"', async () => {
    const { getByText } = render(<MistakesDeckScreen />);
    await flush();
    expect(getByText('All done for now')).toBeTruthy();
  });

  it('a szó-kártya chipje "Word", Check után előre kijelölt "Knew it" pontos egyezésnél', async () => {
    await seedBatch();
    const { getByText, UNSAFE_getByType } = render(<MistakesDeckScreen />);
    await flush();

    // Az első kártya (fájl-sorrend: mondatok, majd szavak, majd drillek) az s1 mondat.
    expect(getByText('Sentence')).toBeTruthy();
    fireEvent.changeText(UNSAFE_getByType(TextInput), 'No tengo tomate.');
    fireEvent.press(getByText('✓ Check'));
    await flush();

    expect(getByText('Next → Knew it')).toBeTruthy();
    expect(getByText('Knew it')).toBeTruthy();
    expect(getByText("Didn't know")).toBeTruthy();
    // "You said:" a régi hibás mondattal.
    expect(getByText('You said:')).toBeTruthy();
    expect(getByText('Pero no tienes tomate.')).toBeTruthy();
  });

  it('rossz válasz -> előre kijelölt "Didn\'t know", a koppintás a következő kártyára visz', async () => {
    await seedBatch();
    const { getByText, UNSAFE_getByType } = render(<MistakesDeckScreen />);
    await flush();

    fireEvent.changeText(UNSAFE_getByType(TextInput), 'algo mal');
    fireEvent.press(getByText('✓ Check'));
    await flush();

    expect(getByText("Next → Didn't know")).toBeTruthy();
    fireEvent.press(getByText("Didn't know"));
    await flush();

    // Visszakerül a sor végére (due === today), a következő kártya jön: s2.
    expect(getByText('✓ Check')).toBeTruthy();
  });
});
