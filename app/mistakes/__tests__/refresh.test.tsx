// Coming back to the report (blur, then focus) re-reads the deck: after practising in the deck and
// pressing Back, the "Practice my mistakes (N due)" button shows the new number, not the old one.
// Mock pattern: app/(tabs)/__tests__/practiceFocus.test.tsx (a useFocusEffect that can be fired again).

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));

let mockFocus: (() => void) | null = null;
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    mockFocus = cb;
    useEffect(cb, []);
  },
}));

import { act, render } from '@testing-library/react-native';

import { getDb } from '@/lib/database';
import { cardsForBatches, pickMistakeSession } from '@/lib/mistakes/deck';
import { validateMistakesPayload } from '@/lib/mistakes/format';
import sample from '@/lib/mistakes/__fixtures__/sample.json';
import { sm2NewCard } from '@/lib/sm2';
import { localDateString } from '@/lib/usageStats';
import MistakesReportScreen from '../index';

const flush = async (times = 4) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

// The tab loses focus and gets it back: the focus effect runs again.
const refocus = async () => {
  await act(async () => {
    mockFocus?.();
  });
  await flush();
};

describe('Report (app/mistakes/index.tsx) refreshes on focus', () => {
  beforeEach(() => {
    mockFocus = null;
  });

  it('a card learned in the deck lowers the due number after blur and focus', async () => {
    const result = validateMistakesPayload(sample);
    if (!result.ok) throw new Error(result.error);
    await getDb().saveMistakeBatch(result.batch.batchId, JSON.stringify(result.batch), '2026-09-23T10:00:00.000Z');
    const cards = cardsForBatches([result.batch]);
    const today = localDateString();

    const { getAllByText, queryAllByText, unmount } = render(<MistakesReportScreen />);
    await flush();

    const before = pickMistakeSession([], cards, today).length;
    expect(getAllByText(`Practice my mistakes (${before} due)`).length).toBeGreaterThan(0);

    // The deck grades the first card: it is now scheduled for later and no longer due today.
    await getDb().upsertMistakeCard({
      ...sm2NewCard(cards[0].cardId),
      state: 'review',
      interval: 4,
      reps: 2,
      due: '2099-01-01',
      lastReview: today,
      introducedAt: '2000-01-01',
    });
    const after = pickMistakeSession(await getDb().getMistakeCards(), cards, today).length;
    expect(after).toBe(before - 1);

    await refocus();

    expect(getAllByText(`Practice my mistakes (${after} due)`).length).toBeGreaterThan(0);
    expect(queryAllByText(`Practice my mistakes (${before} due)`)).toHaveLength(0);
    unmount();
  });
});
