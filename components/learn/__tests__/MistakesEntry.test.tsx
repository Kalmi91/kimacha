// PLAN-hibaim.md 4. lépés (PCIC-belépő): rejtve marad betöltött köteg nélkül,
// és a due-számot mutatja, ha van köteg.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

import { act, render } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { getDb } from '@/lib/database';
import { validateMistakesPayload } from '@/lib/mistakes/format';
import sample from '@/lib/mistakes/__fixtures__/sample.json';
import MistakesEntry from '../MistakesEntry';

const flush = async (times = 3) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('MistakesEntry (PCIC-belépő)', () => {
  it('nincs betöltött köteg -> nem renderel semmit', async () => {
    const { toJSON } = render(<MistakesEntry colors={Colors.light} />);
    await flush();
    expect(toJSON()).toBeNull();
  });

  it('betöltött köteggel a due-számot mutatja', async () => {
    const result = validateMistakesPayload(sample);
    if (!result.ok) throw new Error(result.error);
    await getDb().saveMistakeBatch(result.batch.batchId, JSON.stringify(result.batch), '2026-09-23T10:00:00.000Z');

    const { getByText } = render(<MistakesEntry colors={Colors.light} />);
    await flush();

    // 2 sentence (1 doubtful kimarad) + 2 word + 3 drill = 7 kártya, mind új.
    expect(getByText('📕 My mistakes (7)')).toBeTruthy();
  });
});
