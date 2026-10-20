// PCIC entry point: stays hidden without a loaded batch,
// and shows the due count when there is a batch.

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

import { render } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { getDb } from '@/lib/database';
import { validateMistakesPayload } from '@/lib/mistakes/format';
import sample from '@/lib/mistakes/__fixtures__/sample.json';
import MistakesEntry from '../MistakesEntry';
import { makeFlush } from '@/test-utils/flush';

const flush = makeFlush(3);

describe('MistakesEntry (PCIC entry)', () => {
  it('no batch loaded -> renders nothing', async () => {
    const { toJSON } = render(<MistakesEntry colors={Colors.light} />);
    await flush();
    expect(toJSON()).toBeNull();
  });

  it('with a loaded batch shows the due count', async () => {
    const result = validateMistakesPayload(sample);
    if (!result.ok) throw new Error(result.error);
    await getDb().saveMistakeBatch(result.batch.batchId, JSON.stringify(result.batch), '2026-09-23T10:00:00.000Z');

    const { getByText } = render(<MistakesEntry colors={Colors.light} />);
    await flush();

    // 2 sentences (1 doubtful one drops out) + 2 words + 3 drills = 7 cards, all new.
    expect(getByText('📕 My mistakes (7)')).toBeTruthy();
  });
});
