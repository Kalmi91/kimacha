// The standing hook (lib/grammar/useLevelShown.ts): nothing until THIS pair+level is read, never another key's value,
// a failed read falls back to the real percent.

import { act, renderHook } from '@testing-library/react-native';

import { levelShownKey } from '@/lib/grammar/levelTest';
import { useLevelShown } from '@/lib/grammar/useLevelShown';

const mockLoad = jest.fn();
jest.mock('@/lib/database', () => ({ getDb: () => ({}) }));
jest.mock('@/lib/resumeStore', () => ({ loadResumeValue: (...a: unknown[]) => mockLoad(...a) }));

const settle = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

describe('useLevelShown', () => {
  beforeEach(() => mockLoad.mockReset());

  it('is null until the stored value is read, then the larger of it and the real percent', async () => {
    mockLoad.mockResolvedValue(41.5);
    const { result } = renderHook(() => useLevelShown('en→es', 'A1', 12, 0));
    expect(result.current).toBeNull();
    await settle();
    expect(result.current).toBe(41.5);
  });

  it('a level change never shows the previous level value, even for a moment', async () => {
    mockLoad.mockImplementation(async (_db: unknown, key: string) => (key === levelShownKey('en→es', 'A1') ? 41.5 : 7));
    const { result, rerender } = renderHook(({ level }: { level: string }) => useLevelShown('en→es', level, 3, 0), { initialProps: { level: 'A1' } });
    await settle();
    expect(result.current).toBe(41.5);
    rerender({ level: 'A2' });
    expect(result.current).toBeNull();
    await settle();
    expect(result.current).toBe(7);
  });

  it('a failed read counts as nothing stored: the real percent', async () => {
    mockLoad.mockRejectedValue(new Error('x'));
    const { result } = renderHook(() => useLevelShown('en→es', 'A1', 12, 0));
    await settle();
    expect(result.current).toBe(12);
  });
});
