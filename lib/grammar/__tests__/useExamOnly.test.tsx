// The "exam topics only" hook (lib/grammar/useExamOnly.ts): a tap made while the mount read is still running is kept.

import { act, renderHook } from '@testing-library/react-native';

import { EXAM_ONLY_KEY, useExamOnly } from '@/lib/grammar/useExamOnly';

const mockLoad = jest.fn();
const mockSave = jest.fn();
jest.mock('@/lib/database', () => ({ getDb: () => ({}) }));
jest.mock('@/lib/resumeStore', () => ({
  loadResumeValue: (...a: unknown[]) => mockLoad(...a),
  saveResumeValue: (...a: unknown[]) => mockSave(...a),
}));

const settle = () => act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });

describe('useExamOnly', () => {
  beforeEach(() => {
    mockLoad.mockReset();
    mockSave.mockReset();
    mockSave.mockResolvedValue(undefined);
  });

  it('a tap made before the mount read ends wins over the late read', async () => {
    let release: (v: unknown) => void = () => {};
    mockLoad.mockReturnValue(new Promise((res) => { release = res; }));
    const { result } = renderHook(() => useExamOnly());
    expect(result.current[0]).toBe(false);
    act(() => result.current[1]());
    expect(result.current[0]).toBe(true);
    release(null);
    await settle();
    expect(result.current[0]).toBe(true);
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave).toHaveBeenCalledWith(expect.anything(), EXAM_ONLY_KEY, true);
  });

  it('without a tap the mount read still applies', async () => {
    mockLoad.mockResolvedValue(true);
    const { result } = renderHook(() => useExamOnly());
    await settle();
    expect(result.current[0]).toBe(true);
    expect(mockSave).not.toHaveBeenCalled();
  });
});
