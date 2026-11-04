import { act, renderHook } from '@testing-library/react-native';
import { DeviceEventEmitter, Platform } from 'react-native';
import { useDockLift } from '../useDockLift';

// shared out of app/(tabs)/index.tsx (Learn) so the PCIC tab's docked
// Check bar lifts above the keyboard the same way. `Keyboard.addListener`
// registers on the shared `DeviceEventEmitter`, so tests drive it from there.
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 48 }),
}));

describe('useDockLift', () => {
  it('lifts by keyboard height + bottom inset while open, drops to the inset when closed', () => {
    const { result } = renderHook(() => useDockLift());
    expect(result.current.dockLift).toBe(48); // closed: just the inset

    act(() => {
      DeviceEventEmitter.emit('keyboardDidShow', { endCoordinates: { height: 300 } });
    });
    expect(result.current.kbHeight).toBe(300);
    expect(result.current.dockLift).toBe(348); // 300 + 48

    act(() => {
      DeviceEventEmitter.emit('keyboardDidHide', {});
    });
    expect(result.current.kbHeight).toBe(0);
    expect(result.current.dockLift).toBe(48);
  });

  // the web build: react-native-web fires no Keyboard events, the visual viewport is the only signal.
  describe('on the web', () => {
    type Listener = () => void;
    let vv: { height: number; offsetTop: number; listeners: Record<string, Set<Listener>>; addEventListener: jest.Mock; removeEventListener: jest.Mock };
    const fire = (type: string) => act(() => { vv.listeners[type].forEach((fn) => fn()); });

    beforeEach(() => {
      jest.replaceProperty(Platform, 'OS', 'web');
      vv = {
        height: 800,
        offsetTop: 0,
        listeners: { resize: new Set(), scroll: new Set() },
        addEventListener: jest.fn((type: string, fn: Listener) => { vv.listeners[type].add(fn); }),
        removeEventListener: jest.fn((type: string, fn: Listener) => { vv.listeners[type].delete(fn); }),
      };
      Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true, writable: true });
      Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true, writable: true });
    });

    afterEach(() => {
      jest.restoreAllMocks();
      Reflect.deleteProperty(window, 'visualViewport');
    });

    it('lifts by what the keyboard covers of the window, and drops back when it closes', () => {
      const { result } = renderHook(() => useDockLift());
      expect(result.current.kbHeight).toBe(0);

      vv.height = 500; // keyboard open: the visual viewport is 300 px shorter than the window
      fire('resize');
      expect(result.current.kbHeight).toBe(300);
      expect(result.current.dockLift).toBe(348);

      vv.height = 800;
      fire('resize');
      expect(result.current.kbHeight).toBe(0);
      expect(result.current.dockLift).toBe(48);
    });

    it('counts the visual viewport scrolling down the page, and ignores a gap under 80 px', () => {
      const { result } = renderHook(() => useDockLift());

      vv.height = 500;
      vv.offsetTop = 100; // the keyboard scrolled the visual viewport 100 px down: 800 - 500 - 100 left for the keys
      fire('scroll');
      expect(result.current.kbHeight).toBe(200);

      vv.height = 740; // URL bar or pinch: 60 px is not a keyboard
      vv.offsetTop = 0;
      fire('resize');
      expect(result.current.kbHeight).toBe(0);
    });

    it('reads the keyboard that is already open at mount and removes its listeners on unmount', () => {
      vv.height = 450;
      const { result, unmount } = renderHook(() => useDockLift());
      expect(result.current.kbHeight).toBe(350);
      expect(vv.listeners.resize.size).toBe(1);
      expect(vv.listeners.scroll.size).toBe(1);

      unmount();
      expect(vv.listeners.resize.size).toBe(0);
      expect(vv.listeners.scroll.size).toBe(0);
    });

    it('does nothing without a visual viewport', () => {
      Reflect.deleteProperty(window, 'visualViewport');
      const { result } = renderHook(() => useDockLift());
      expect(result.current.kbHeight).toBe(0);
      expect(result.current.dockLift).toBe(48);
    });
  });
});
