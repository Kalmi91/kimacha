// The phone browser's keyboard, for the web build. Chrome (seen on the kimacha_smoke emulator, 2026-11-04) shrinks the window
// and the visual viewport together, 411x785 to 411x409, then centers the focused field in its scroller 13 ms later. Safari
// keeps the window and shrinks only the visual viewport.
import { act, cleanup, renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { alignedScrollTop, useWebKeyboardOpen } from '../webKeyboard';

type Listener = () => void;
const emitter = () => {
  const listeners: Record<string, Set<Listener>> = {};
  return {
    listeners,
    addEventListener: jest.fn((type: string, fn: Listener) => {
      (listeners[type] ??= new Set()).add(fn);
    }),
    removeEventListener: jest.fn((type: string, fn: Listener) => {
      listeners[type]?.delete(fn);
    }),
    fire: (type: string) => [...(listeners[type] ?? [])].forEach((fn) => fn()),
  };
};
const rect = (top: number, bottom: number) => () => ({ top, bottom });

describe('useWebKeyboardOpen', () => {
  const FIELD = { tagName: 'INPUT', type: 'text', parentElement: null };
  let vv: ReturnType<typeof emitter> & { height: number; scale: number };
  let doc: ReturnType<typeof emitter> & { activeElement: unknown };

  const setViewport = (height: number, inner = height) => {
    vv.height = height;
    Object.defineProperty(window, 'innerHeight', { value: inner, configurable: true, writable: true });
    act(() => vv.fire('resize'));
  };
  const focus = (el: unknown) => {
    doc.activeElement = el;
    act(() => doc.fire(el ? 'focusin' : 'focusout'));
  };

  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'web');
    vv = Object.assign(emitter(), { height: 785, scale: 1 });
    doc = Object.assign(emitter(), { activeElement: null });
    Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 785, configurable: true, writable: true });
    Object.defineProperty(window, 'innerWidth', { value: 411, configurable: true, writable: true });
    Object.defineProperty(globalThis, 'document', { value: doc, configurable: true, writable: true });
    Object.defineProperty(window, 'getComputedStyle', { value: () => ({ overflowY: 'visible' }), configurable: true, writable: true });
  });

  afterEach(async () => {
    await act(async () => cleanup()); // the hook lets go of the fake document before it goes
    jest.restoreAllMocks();
    Reflect.deleteProperty(window, 'visualViewport');
    Reflect.deleteProperty(window, 'getComputedStyle');
    Reflect.deleteProperty(globalThis, 'document');
  });

  it('Chrome: the window shrinks with the keyboard, and it reads open until the keyboard closes', () => {
    const { result } = renderHook(() => useWebKeyboardOpen());
    expect(result.current).toBe(false);

    focus(FIELD);
    expect(result.current).toBe(false); // focused, keys not up yet

    setViewport(721); // the first step of the keyboard's animation is under the threshold
    expect(result.current).toBe(false);
    setViewport(409);
    expect(result.current).toBe(true);

    setViewport(785); // the Back key closes the keyboard and the field keeps the focus
    expect(doc.activeElement).toBe(FIELD);
    expect(result.current).toBe(false);
  });

  it('Safari: the window stays, only the visual viewport shrinks', () => {
    const { result } = renderHook(() => useWebKeyboardOpen());
    focus(FIELD);
    setViewport(450, 785);
    expect(result.current).toBe(true);
  });

  it('ignores the URL bar, a pinch zoom and a short window with no field focused', () => {
    const { result } = renderHook(() => useWebKeyboardOpen());
    focus(FIELD);

    setViewport(725); // 60 px: the URL bar
    expect(result.current).toBe(false);

    vv.scale = 2;
    setViewport(392, 785); // zoomed in: half as tall, twice the scale
    expect(result.current).toBe(false);
    vv.scale = 1;
    setViewport(785);

    focus(null);
    setViewport(409);
    expect(result.current).toBe(false);
    focus({ tagName: 'BUTTON' });
    expect(result.current).toBe(false);
    focus({ tagName: 'INPUT', type: 'checkbox' });
    expect(result.current).toBe(false);
    focus({ tagName: 'TEXTAREA' }); // the feedback form's field
    expect(result.current).toBe(true);
  });

  it('leaving the field waits a moment, so the tap that left it still lands on its button', () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useWebKeyboardOpen());
    focus(FIELD);
    setViewport(409);
    expect(result.current).toBe(true);

    focus({ tagName: 'BUTTON' }); // the tap on Check takes the focus: the layout must not move yet
    expect(result.current).toBe(true);
    act(() => { jest.advanceTimersByTime(299); });
    expect(result.current).toBe(true);
    act(() => { jest.advanceTimersByTime(1); });
    expect(result.current).toBe(false); // a keyboard that does not close (a short desktop window) does not hold it either

    focus(FIELD);
    expect(result.current).toBe(true);
    focus(null); // the next card's field replaces this one: no change once it has the focus
    focus(FIELD);
    act(() => { jest.advanceTimersByTime(1000); });
    expect(result.current).toBe(true);
    jest.useRealTimers();
  });

  it('a rotation starts a new measure: landscape is not a keyboard', () => {
    const { result } = renderHook(() => useWebKeyboardOpen());
    focus(FIELD);
    Object.defineProperty(window, 'innerWidth', { value: 785, configurable: true, writable: true });
    setViewport(411);
    expect(result.current).toBe(false);

    setViewport(150); // the keyboard opens in landscape
    expect(result.current).toBe(true);
  });

  it('removes its listeners when the last user unmounts', () => {
    const first = renderHook(() => useWebKeyboardOpen());
    const second = renderHook(() => useWebKeyboardOpen());
    expect(vv.listeners.resize.size).toBe(1);
    first.unmount();
    expect(vv.listeners.resize.size).toBe(1);
    second.unmount();
    expect(vv.listeners.resize.size).toBe(0);
    expect(doc.listeners.focusin.size).toBe(0);
    expect(doc.listeners.focusout.size).toBe(0);
  });

  it('is always false and listens to nothing in the phone app', () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const { result } = renderHook(() => useWebKeyboardOpen());
    focus(FIELD);
    expect(result.current).toBe(false);
    expect(vv.addEventListener).not.toHaveBeenCalled();
    expect(doc.addEventListener).not.toHaveBeenCalled();
  });

  describe('with a typed card on screen', () => {
    // field top 139, bottom 193 in the card, in a scroller at 69-300 of the window, the docked bar's top at 320
    const typedCard = (dock: unknown) => {
      const scroller = Object.assign(emitter(), {
        scrollTop: 0,
        parentElement: { querySelector: () => dock },
        getBoundingClientRect: rect(69, 300),
      });
      const field = {
        tagName: 'INPUT',
        type: 'text',
        parentElement: scroller,
        getBoundingClientRect: () => ({ top: 69 + 139 - scroller.scrollTop, bottom: 69 + 193 - scroller.scrollTop }),
      };
      Object.defineProperty(window, 'getComputedStyle', {
        value: (el: unknown) => ({ overflowY: el === scroller ? 'auto' : 'visible' }),
        configurable: true,
        writable: true,
      });
      return { scroller, field };
    };

    beforeEach(() => {
      jest.useFakeTimers();
      jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
        cb(0);
        return 1;
      });
      jest.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
    });
    afterEach(() => jest.useRealTimers());

    it('undoes the centering of the field by the browser, for a moment after the keyboard opens', () => {
      const { scroller, field } = typedCard({ getBoundingClientRect: rect(320, 390) });
      renderHook(() => useWebKeyboardOpen());
      focus(field);
      setViewport(409);
      expect(scroller.scrollTop).toBe(0); // the field fits under the prompt, nothing to scroll

      scroller.scrollTop = 91; // Chrome centers the field
      scroller.fire('scroll');
      expect(scroller.scrollTop).toBe(0);

      jest.advanceTimersByTime(1000);
      scroller.scrollTop = 91; // later on, a scroll is the learner's own
      scroller.fire('scroll');
      expect(scroller.scrollTop).toBe(91);
      expect(scroller.listeners.scroll.size).toBe(0);
    });

    it('a form without the docked bar keeps the scrolling of the browser', () => {
      const { scroller, field } = typedCard(null);
      renderHook(() => useWebKeyboardOpen());
      focus(field);
      scroller.scrollTop = 91;
      setViewport(409);
      expect(scroller.scrollTop).toBe(91);
      expect(scroller.addEventListener).not.toHaveBeenCalled();
    });
  });
});

describe('alignedScrollTop', () => {
  it('stays at the top when the field already fits above the bar', () => {
    expect(alignedScrollTop(0, { top: 200, bottom: 254 }, { top: 100, bottom: 300 })).toBe(0);
    expect(alignedScrollTop(91, { top: 109, bottom: 163 }, { top: 100, bottom: 300 })).toBe(0);
  });

  it('otherwise scrolls only as far as it takes to put the field right above the bar', () => {
    expect(alignedScrollTop(0, { top: 280, bottom: 334 }, { top: 100, bottom: 300 })).toBe(42);
    expect(alignedScrollTop(10, { top: 270, bottom: 324 }, { top: 100, bottom: 300 })).toBe(42);
  });

  it('a field taller than the room keeps its top edge in view', () => {
    expect(alignedScrollTop(0, { top: 150, bottom: 500 }, { top: 100, bottom: 300 })).toBe(42);
  });
});
