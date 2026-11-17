import { act, renderHook } from '@testing-library/react-native';
import type { ScrollView, TextInput, View } from 'react-native';

import { useAnswerAboveKeys } from '../useAnswerAboveKeys';

describe('useAnswerAboveKeys on short screens', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  function setup(viewportH = 490, noteOpen = false, compact = true) {
    const inner = {} as View;
    const scrollTo = jest.fn();
    const scrollRef = { current: { getInnerViewRef: () => inner, scrollTo } as unknown as ScrollView };
    const fieldMeasure = jest.fn((_inner, callback) => callback(0, 150, 280, 58));
    const promptMeasure = jest.fn((_inner, callback) => callback(0, 90, 280, 52));
    const inputRef = { current: { measureLayout: fieldMeasure } as unknown as TextInput };
    const promptRef = { current: { measureLayout: promptMeasure } as unknown as View };
    const hook = renderHook(({ keyboard, picture, small, key }: { keyboard: number; picture: boolean; small: boolean; key: string }) => useAnswerAboveKeys(
      scrollRef, inputRef, keyboard, 69, keyboard > 0 ? 332 : 24, picture,
      { compact: small, promptRef, cardKey: key },
    ), { initialProps: { keyboard: 308, picture: noteOpen, small: compact, key: 'card-1' } });
    act(() => hook.result.current.setScrollerH(viewportH));
    return { ...hook, scrollTo, fieldMeasure, promptMeasure, inputRef, scrollRef };
  }

  it.each([false, true])('keeps the prompt and answer above the keys with picture open=%s', (noteOpen) => {
    const { result, scrollTo } = setup(490, noteOpen);
    expect(result.current.stepAside).toBe(true);
    act(() => jest.advanceTimersByTime(60));
    expect(result.current.stepAside).toBe(true);
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 62, animated: false });
    // 90 - 62 keeps the prompt visible; 150 + 58 - 62 ends 12 dp above the keys.
    expect(result.current.relayout).toBe(1);
  });

  it('keeps Check when the measured prompt and field both fit above it', () => {
    const { result, scrollTo } = setup(600);
    act(() => jest.advanceTimersByTime(60));
    expect(result.current.stepAside).toBe(false);
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 21, animated: false });
  });

  it('remeasures the next card while the keyboard stays open', () => {
    const { result, rerender, fieldMeasure, scrollTo } = setup(600);
    act(() => jest.advanceTimersByTime(60));
    expect(result.current.stepAside).toBe(false);
    fieldMeasure.mockImplementation((_inner, callback) => callback(0, 260, 280, 58));
    rerender({ keyboard: 308, picture: false, small: true, key: 'card-2' });
    expect(result.current.stepAside).toBe(true);
    act(() => jest.advanceTimersByTime(60));
    expect(result.current.stepAside).toBe(true);
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 62, animated: false });
  });

  it('remeasures a field relayout and a changed viewport', () => {
    const { result, fieldMeasure, scrollTo } = setup(600);
    act(() => jest.advanceTimersByTime(60));
    fieldMeasure.mockImplementation((_inner, callback) => callback(0, 170, 280, 58));
    act(() => {
      result.current.onFieldLayout();
      result.current.setScrollerH(490);
    });
    act(() => jest.advanceTimersByTime(60));
    expect(result.current.stepAside).toBe(true);
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 82, animated: false });
  });

  it('does not scroll a tall screen with the picture closed', () => {
    const { result, scrollTo } = setup(790, false, false);
    act(() => jest.advanceTimersByTime(60));
    expect(result.current.stepAside).toBe(false);
    expect(scrollTo).not.toHaveBeenCalled();
    expect(result.current.relayout).toBe(0);
  });

  it('preserves the existing picture-open correction on tall screens', () => {
    const { scrollTo, fieldMeasure } = setup(790, true, false);
    fieldMeasure.mockImplementation((_inner, callback) => callback(0, 600, 280, 58));
    act(() => jest.advanceTimersByTime(60));
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 281, animated: false });
  });

  it('cancels pending alignment when the keyboard closes', () => {
    const { result, rerender, scrollTo } = setup();
    rerender({ keyboard: 0, picture: false, small: false, key: 'card-1' });
    act(() => jest.advanceTimersByTime(60));
    expect(scrollTo).not.toHaveBeenCalled();
    expect(result.current.stepAside).toBe(false);
    expect(result.current.relayout).toBe(0);
  });

  it('ignores a delayed measurement from an unmounted card', () => {
    const { unmount, fieldMeasure, scrollTo } = setup();
    let reply: ((x: number, y: number, w: number, h: number) => void) | undefined;
    fieldMeasure.mockImplementation((_inner, callback) => { reply = callback; });
    act(() => jest.advanceTimersByTime(60));
    unmount();
    act(() => reply?.(0, 150, 280, 58));
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
