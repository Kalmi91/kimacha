// The one path for a screen's game_progress row writes: the row goes to the DB as given, a failed save does not throw.


import { renderHook } from '@testing-library/react-native';

import { getDb } from '@/lib/database';
import { useSessionProgress } from '../useSessionProgress';

describe('useSessionProgress', () => {
  afterEach(() => jest.restoreAllMocks());

  it('persistRow writes the row to game_progress', async () => {
    const { result } = renderHook(() => useSessionProgress());
    result.current.persistRow('sp-test', 'item-1', 'progress', { n: 2 });
    await Promise.resolve();
    const rows = await getDb().getGameProgress('sp-test');
    expect(rows.find((r) => r.itemId === 'item-1')).toMatchObject({ state: 'progress', data: { n: 2 } });
    await getDb().resetGameProgress('sp-test');
  });

  it('a failed save does not throw and the function stays the same between renders', async () => {
    jest.spyOn(getDb(), 'setGameProgress').mockRejectedValue(new Error('disk full'));
    const { result, rerender } = renderHook(() => useSessionProgress());
    const first = result.current.persistRow;
    expect(() => result.current.persistRow('sp-test', 'item-1', 'progress')).not.toThrow();
    await Promise.resolve();
    rerender({});
    expect(result.current.persistRow).toBe(first);
  });
});
