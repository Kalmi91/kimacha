import { renderHook } from '@testing-library/react-native';
import { useRetypeRowScroll } from '../useRetypeRowScroll';

// E151: the keyboard closes right after the wrong answer's Enter, which shrinks the card viewport (the docked bar's
// margin comes back). The row was laid out against the tall viewport, so nothing scrolled and it ended up cut off.
function setup() {
  const scrollTo = jest.fn();
  const inner = {};
  const scrollRef = { current: { getInnerViewRef: () => inner, scrollTo } };
  const row = { measureLayout: (_to: unknown, ok: (x: number, y: number, w: number, h: number) => void) => ok(0, 1647, 300, 60) };
  const hook = renderHook(() => useRetypeRowScroll(scrollRef as never));
  return { scrollTo, hook, row };
}

describe('useRetypeRowScroll (E151)', () => {
  it('scrolls the row into view when the viewport shrinks after the row was laid out', () => {
    const { scrollTo, hook, row } = setup();
    (hook.result.current.rowRef as { current: unknown }).current = row;
    hook.result.current.setViewportH(2000);
    hook.result.current.onRowLayout();
    expect(scrollTo).not.toHaveBeenCalled();
    hook.result.current.setViewportH(1500);
    expect(scrollTo).toHaveBeenCalledWith({ y: 1647 + 60 + 12 - 1500, animated: false });
  });

  it('scrolls on the first layout when the viewport is already measured', () => {
    const { scrollTo, hook, row } = setup();
    (hook.result.current.rowRef as { current: unknown }).current = row;
    hook.result.current.setViewportH(1500);
    hook.result.current.onRowLayout();
    expect(scrollTo).toHaveBeenCalled();
  });

  it('does nothing when the row is not shown', () => {
    const { scrollTo, hook } = setup();
    hook.result.current.setViewportH(1500);
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
