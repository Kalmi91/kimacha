// PLAN-hibaim.md 3. lépés ("Riport"): empty state, and a loaded batch's
// wrong-words / review-again (with and without a written lesson) / doubtful
// sections. Mock-minta: app/(tabs)/__tests__/pcicCardShell.test.tsx.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
}));

import { act, render } from '@testing-library/react-native';

import { getDb } from '@/lib/database';
import { validateMistakesPayload } from '@/lib/mistakes/format';
import sample from '@/lib/mistakes/__fixtures__/sample.json';
import MistakesReportScreen from '../index';

const flush = async (times = 3) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('Riport (app/mistakes/index.tsx)', () => {
  it('nincs betöltött köteg -> üres állapot szöveg, nincs "Practice" gomb', async () => {
    const { getByText, queryByTestId } = render(<MistakesReportScreen />);
    await flush();

    expect(getByText('No mistakes loaded yet. Settings → Load my mistakes.')).toBeTruthy();
    expect(queryByTestId('mistakes-practice-btn')).toBeNull();
  });

  it('betöltött köteg: cím/dátum, wrong words, review-again (van lecke / nincs lecke), doubtful mondat', async () => {
    const result = validateMistakesPayload(sample);
    if (!result.ok) throw new Error(result.error);
    const batch = { ...result.batch, patterns: [{ ...result.batch.patterns[1], lessons: ['ser-estar', 'totally-fake-topic-xyz'] }] };
    await getDb().saveMistakeBatch(batch.batchId, JSON.stringify(batch), '2026-09-23T10:00:00.000Z');

    const { getByText, getByTestId } = render(<MistakesReportScreen />);
    await flush();

    expect(getByText('Sample mistakes batch')).toBeTruthy();
    expect(getByText('2026-09-23')).toBeTruthy();
    expect(getByTestId('mistakes-practice-btn')).toBeTruthy();

    // Words you got wrong: wrong -> correction, note.
    expect(getByText('Words you got wrong')).toBeTruthy();
    expect(getByText(/tienes → tengo/)).toBeTruthy();
    expect(getByText('yo form of tener')).toBeTruthy();

    // Review again: pattern title + rule, a real lesson (button) and an unknown one (text).
    expect(getByText('Review again')).toBeTruthy();
    expect(getByText('Use estar for a temporary state, not ser')).toBeTruthy();
    expect(getByText('No lesson in the app, the deck drills it')).toBeTruthy();

    // Doubtful sentence (s3).
    expect(getByText(/Not in the deck \(correction uncertain\)/)).toBeTruthy();
    expect(getByText(/Soy confundido\. → Estoy confundido\./)).toBeTruthy();
  });
});
